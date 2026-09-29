import { z } from "zod";
import { readBody } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({ text: z.string().trim().min(1).max(2000), voice: z.enum(["Aoede", "Sulafat", "Leda"]) }).strict();
export async function POST(request: Request) {
  if (!checkRateLimit(request, "tts")) return Response.json({ error: "The voice demo has reached its usage limit for now." }, { status: 429 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "Gemini streaming voice is unavailable." }, { status: 503 });
  try {
    const { text, voice } = schema.parse(await readBody(request));
    const model = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts";
    if (!/^gemini-(3\.[1-9]|[4-9])/.test(model)) return Response.json({ error: "Streaming requires a Gemini 3.1 or newer voice model." }, { status: 503 });
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: `Speak exactly this text as Aria, a warm adult female care specialist, with friendly natural Indian English cadence. Do not add words: ${text}` }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(50000)]),
    });
    if (!upstream.ok || !upstream.body) return Response.json({ error: upstream.status === 403 ? "Gemini access is disabled for this API key." : "Streaming voice is temporarily unavailable." }, { status: 502 });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader(); const decoder = new TextDecoder(); let pending = "";
        try {
          while (true) {
            const { value, done } = await reader.read(); if (done) break;
            pending += decoder.decode(value, { stream: true }); pending = pending.replace(/\r\n/g, "\n");
            let end: number;
            while ((end = pending.indexOf("\n\n")) !== -1) {
              const event = pending.slice(0, end).replace(/\r/g, ""); pending = pending.slice(end + 2);
              const line = event.split("\n").find(value => value.startsWith("data: "));
              if (!line) continue;
              const payload = JSON.parse(line.slice(6));
              const parts: { inlineData?: { mimeType: string; data: string } }[] = payload.candidates?.[0]?.content?.parts || [];
              for (const part of parts) if (part.inlineData?.data) {
                let bytes = Buffer.from(part.inlineData.data, "base64");
                if (/audio\/wav/i.test(part.inlineData.mimeType)) bytes = bytes.subarray(44);
                if (bytes.length) controller.enqueue(new Uint8Array(bytes));
              }
            }
          }
          controller.close();
        } catch (error) { controller.error(error); }
        finally { await reader.cancel().catch(() => {}); }
      },
      cancel() { void upstream.body?.cancel().catch(() => {}); },
    });
    return new Response(stream, { headers: { "Content-Type": "audio/L16; rate=24000; channels=1", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ error: "Unable to start streaming voice." }, { status: 502 }); }
}
