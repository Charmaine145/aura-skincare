import { test } from "node:test";
import assert from "node:assert/strict";
import { pcmToWav } from "../src/lib/audio";
import { pickBrowserVoice } from "../src/lib/speech";
import { aiReply } from "../src/lib/conversation";
import { newSession } from "../src/lib/session";

test("Gemini PCM becomes a valid mono 24 kHz WAV without altering samples", () => {
  const pcm = Buffer.from([0, 0, 255, 127, 0, 128]); const wav = pcmToWav(pcm);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF"); assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt32LE(4), wav.length - 8); assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(22), 1); assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), pcm.length); assert.deepEqual(wav.subarray(44), pcm);
  assert.throws(() => pcmToWav(Buffer.alloc(3))); assert.throws(() => pcmToWav(pcm, 1));
});
test("browser fallback prefers recognizable female and Indian English voices", () => {
  const voices = [{ name: "Microsoft Ravi", lang: "en-IN" }, { name: "Microsoft Zira", lang: "en-US" }, { name: "Microsoft Neerja Online (Natural)", lang: "en-IN" }];
  assert.equal(pickBrowserVoice(voices)?.name, voices[2].name);
  assert.equal(pickBrowserVoice(voices.slice(0, 2))?.name, voices[1].name);
  assert.equal(pickBrowserVoice([{ name: "French", lang: "fr-FR" }]), null);
});
test("Gemini uses its native tool API and cannot override a return refusal", async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  const originalModel = process.env.GEMINI_MODEL; process.env.GEMINI_MODEL = "gemini-3.1-flash-lite";
  globalThis.fetch = (async (url, options) => {
    assert.match(String(url), /^https:\/\/generativelanguage\.googleapis\.com/);
    const body = JSON.parse(String(options?.body)); assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "LOW"); assert.equal(body.tools[0].functionDeclarations[0].name, "get_order_details");
    return Response.json({ candidates: [{ content: { parts: [{ functionCall: { name: "check_return_eligibility", args: { order_id: "ORD-102", is_opened: false } } }] } }] });
  }) as typeof fetch;
  try { const session = newSession(); const reply = await aiReply([{ role: "user", content: "Can I return ORD-102?" }], session); assert.match(reply, /outside our 7-day/); assert.equal(session.outcomes.at(-1)?.resolution, "POLICY_DECLINED"); }
  finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel; }
});
test("a completed Gemini lookup remains resolved in the call summary", async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.GEMINI_API_KEY, originalModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = "test-key"; process.env.GEMINI_MODEL = "gemini-3.5-flash-lite";
  let calls = 0;
  globalThis.fetch = (async () => Response.json(calls++ === 0 ? { candidates: [{ content: { parts: [{ functionCall: { name: "get_order_details", args: { order_id: "ORD-101" } } }] } }] } : { candidates: [{ content: { parts: [{ text: "Your order is out for delivery." }] } }] })) as typeof fetch;
  try { const session = newSession(); assert.match(await aiReply([{ role: "user", content: "Where is ORD-101?" }], session), /out for delivery/); assert.equal(session.outcomes.length, 1); assert.equal(session.outcomes[0].resolution, "RESOLVED"); }
  finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel; }
});
test("an out-of-scope Gemini reply is recorded as a policy decline", async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  globalThis.fetch = (async () => Response.json({ candidates: [{ content: { parts: [{ text: "I can help with Aura Skincare, but cannot book flights." }] } }] })) as typeof fetch;
  try { const session = newSession(); await aiReply([{ role: "user", content: "Can you book me a flight?" }], session); assert.equal(session.outcomes.at(-1)?.resolution, "POLICY_DECLINED"); }
  finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; }
});
