import { conversationProvider } from "@/lib/provider";
export const dynamic = "force-dynamic";
export function GET() {
  const provider = conversationProvider();
  return Response.json({ mode: provider ? "ai" : "demo", provider: provider?.name, cloudVoice: Boolean(provider), cloudTranscription: Boolean(process.env.GEMINI_API_KEY), voiceProvider: process.env.GEMINI_API_KEY ? "Gemini" : process.env.OPENAI_API_KEY ? "OpenAI" : null, defaultVoice: process.env.GEMINI_TTS_VOICE || "Aoede" });
}
