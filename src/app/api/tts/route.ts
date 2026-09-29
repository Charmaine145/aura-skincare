import { z } from "zod";
import { createHash } from "node:crypto";
import { pcmToWav } from "@/lib/audio";
import { readBody } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({ text: z.string().trim().min(1).max(2000), voice: z.enum(["Aoede", "Sulafat", "Leda"]).default("Aoede") }).strict();
const cache = new Map<string, { bytes: Buffer; type: string; expires: number }>();
let cacheBytes = 0;
function cacheAudio(key: string, bytes: Buffer, type: string) {
  if (bytes.length > 8_000_000) return;
  while (cache.size && (cacheBytes + bytes.length > 8_000_000 || cache.size >= 24)) {
    const oldest = cache.keys().next().value!; cacheBytes -= cache.get(oldest)!.bytes.length; cache.delete(oldest);
  }
  cache.set(key, { bytes, type, expires: Date.now() + 10 * 60 * 1000 }); cacheBytes += bytes.length;
}
function audioResponse(bytes: Buffer, type: string) { return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  if (!checkRateLimit(request, "tts")) return Response.json({ error: "The voice demo has reached its usage limit for now." }, { status: 429 });
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  if (!gemini && !process.env.OPENAI_API_KEY) return Response.json({ error: "Premium voice needs a configured API key. Browser voice is available." }, { status: 503 });
  try {
    const { text, voice } = schema.parse(await readBody(request));
    const model = gemini ? process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-lite-tts" : process.env.OPENAI_TTS_MODEL || "tts-1";
    const key = createHash("sha256").update(JSON.stringify([gemini, model, voice, text])).digest("hex");
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now()) return audioResponse(saved.bytes, saved.type);
    if (saved) { cacheBytes -= saved.bytes.length; cache.delete(key); }
    if (gemini) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `You are Aria, a friendly adult female skincare care specialist. Speak with a warm smile, gentle reassurance, a natural Indian English accent and an easy conversational pace. Use small natural pauses. No exaggerated excitement, announcer voice, singing, or added words. Read ONLY the following transcript verbatim:\n\n${text}` }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
        signal: AbortSignal.any([AbortSignal.timeout(45000), request.signal]),
      });
      if (!response.ok) return Response.json({ error: response.status === 403 ? "Gemini access is disabled for this API key. Using browser voice for now." : response.status === 429 ? "Premium voice has reached its usage limit. Using browser voice for now." : "Premium voice is unavailable. Using browser voice for now." }, { status: response.status === 429 ? 429 : 502 });
      const data = await response.json();
      const audio = data.candidates?.[0]?.content?.parts?.find((part: { inlineData?: { data: string; mimeType: string } }) => part.inlineData?.data)?.inlineData;
      if (!audio || !/^audio\/(L16|pcm|wav)/i.test(audio.mimeType)) throw new Error("Unexpected audio format");
      const rate = Number(/rate=(\d+)/i.exec(audio.mimeType)?.[1] || 24000);
      const wav = /^audio\/wav/i.test(audio.mimeType) ? Buffer.from(audio.data, "base64") : pcmToWav(Buffer.from(audio.data, "base64"), rate);
      cacheAudio(key, wav, "audio/wav"); return audioResponse(wav, "audio/wav");
    }
    const response = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, voice: process.env.OPENAI_TTS_VOICE || "nova", input: text, response_format: "mp3" }), signal: AbortSignal.any([AbortSignal.timeout(20000), request.signal]) });
    if (!response.ok) return Response.json({ error: "Premium voice is unavailable. Using browser voice for now." }, { status: 502 });
    const bytes = Buffer.from(await response.arrayBuffer()); cacheAudio(key, bytes, "audio/mpeg"); return audioResponse(bytes, "audio/mpeg");
  } catch (error) {
    return Response.json({ error: error instanceof z.ZodError || error instanceof SyntaxError ? "Invalid voice request." : "Unable to generate premium voice. Using browser voice for now." }, { status: error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 502 });
  }
}
