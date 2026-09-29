import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as transcribe } from "../src/app/api/transcribe/route";
import { POST as streamVoice } from "../src/app/api/tts-stream/route";

test("Gemini transcription returns only recognized speech and rejects unsuitable audio", async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = (async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.contents[0].parts[0].inlineData.mimeType, "audio/wav");
    return Response.json({ candidates: [{ content: { parts: [{ text: "Where is my order ORD-101?" }] } }] });
  }) as typeof fetch;
  try {
    const data = new FormData(); data.append("audio", new Blob([new Uint8Array(1200)], { type: "audio/wav" }), "test.wav");
    const result = await transcribe(new Request("http://localhost/api/transcribe", { method: "POST", body: data }));
    assert.equal(result.status, 200); assert.equal((await result.json()).text, "Where is my order ORD-101?");
    const invalid = new FormData(); invalid.append("audio", new Blob([new Uint8Array(1200)], { type: "text/plain" }), "test.txt");
    assert.equal((await transcribe(new Request("http://localhost/api/transcribe", { method: "POST", body: invalid }))).status, 400);
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; }
});

test("streaming speech forwards PCM chunks across split SSE events", async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY, oldModel = process.env.GEMINI_TTS_MODEL;
  process.env.GEMINI_API_KEY = "test-key"; process.env.GEMINI_TTS_MODEL = "gemini-3.8-flash-lite-tts";
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128]);
  const event = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: pcm.toString("base64") } }] } }] })}\r\n\r\n`;
  globalThis.fetch = (async () => new Response(new ReadableStream({ start(controller) { const bytes = new TextEncoder().encode(event); controller.enqueue(bytes.subarray(0, 43)); controller.enqueue(bytes.subarray(43)); controller.close(); } }), { headers: { "Content-Type": "text/event-stream" } })) as typeof fetch;
  try {
    const result = await streamVoice(new Request("http://localhost/api/tts-stream", { method: "POST", body: JSON.stringify({ text: "Hello", voice: "Aoede" }) }));
    assert.equal(result.status, 200); assert.match(result.headers.get("Content-Type") || "", /audio\/L16/);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), pcm);
  } finally { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; if (oldModel === undefined) delete process.env.GEMINI_TTS_MODEL; else process.env.GEMINI_TTS_MODEL = oldModel; }
});
