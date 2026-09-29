import { conversationProvider } from "@/lib/provider";
import { checkRateLimit } from "@/lib/rateLimit";
export const runtime = "nodejs";
export const maxDuration = 60;
const accepted = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/mpeg"]);
export async function POST(request: Request) {
  if (!checkRateLimit(request, "transcription")) return Response.json({ error: "The voice demo has reached its usage limit for now." }, { status: 429 });
  if (!process.env.GEMINI_API_KEY) return Response.json({ error: "Cloud transcription needs a Gemini API key. Please type your question instead." }, { status: 503 });
  try {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File) || !accepted.has(file.type.split(";")[0]) || file.size < 1000 || file.size > 3_000_000) return Response.json({ error: "Please record a short, clear question and try again." }, { status: 400 });
    const provider = conversationProvider()!;
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const models = [...new Set([process.env.GEMINI_STT_MODEL || "gemini-3.1-flash-lite", provider.model])];
    let response: Response | undefined;
    for (const model of models) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: file.type.split(";")[0], data } }, { text: "Transcribe ONLY the customer's spoken words, in the language used. Preserve order IDs accurately. Return nothing else. If no intelligible speech is present, return an empty string." }] }], generationConfig: { maxOutputTokens: 300, thinkingConfig: model.startsWith("gemini-2.5") ? { thinkingBudget: 0 } : { thinkingLevel: "LOW" } } }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(25000)]),
      });
      if (response.status !== 503) break;
    }
    if (!response) throw new Error("No transcription response");
    if (!response.ok) return Response.json({ error: response.status === 403 ? "Gemini access is disabled for this API key. Please type your question until a valid key is configured." : "Voice transcription is temporarily unavailable. Please type your question." }, { status: response.status === 403 ? 503 : 502 });
    const result = await response.json();
    const text = String(result.candidates?.[0]?.content?.parts?.filter((part: { text?: string }) => part.text).map((part: { text: string }) => part.text).join("") || "").trim().slice(0, 2000);
    if (!text || /^\s*(?:[<[]?(?:noise|silence|no speech|inaudible|music)[>\]]?|nothing|none)\s*[.!]?$/i.test(text)) return Response.json({ error: "I couldn't hear you clearly. Please repeat that." }, { status: 422 });
    return Response.json({ text });
  } catch { return Response.json({ error: "Voice transcription failed. Please try again or type your question." }, { status: 502 }); }
}
