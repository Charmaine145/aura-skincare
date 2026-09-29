import { mkdir, writeFile } from "node:fs/promises";
import { aiReply } from "../src/lib/conversation";
import { newSession } from "../src/lib/session";
import { pcmToWav } from "../src/lib/audio";
import { voicePreviewText } from "../src/lib/voiceOptions";
async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required.");
  const session = newSession();
  const reply = await aiReply([{ role: "user", content: "Where is my order ORD-101?" }], session);
  console.log(JSON.stringify({ conversation: reply, toolOutcomes: session.outcomes }));
  const response = await fetch("http://127.0.0.1:3000/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: voicePreviewText, voice: "Aoede" }), signal: AbortSignal.timeout(60000) });
  if (!response.ok) { console.log(JSON.stringify({ ttsStatus: response.status, error: (await response.json()).error })); process.exitCode = 1; return; }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.toString("ascii", 0, 4) !== "RIFF") throw new Error("Voice endpoint did not return WAV audio.");
  await mkdir("output", { recursive: true }); await writeFile("output/aria-friendly-voice.wav", bytes);
  console.log(JSON.stringify({ ttsStatus: response.status, bytes: bytes.length, sampleRate: bytes.readUInt32LE(24), durationSeconds: (bytes.length - 44) / bytes.readUInt32LE(28) }));
}
main().catch(error => { console.error(error instanceof Error ? error.message.replaceAll(process.env.GEMINI_API_KEY || "redact-placeholder", "[redacted]") : "Provider check failed"); process.exitCode = 1; });
