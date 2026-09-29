export function conversationProvider() {
  if (process.env.GEMINI_API_KEY) return { name: "Gemini", key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite", url: "https://generativelanguage.googleapis.com/v1beta/models/" };
  if (process.env.OPENAI_API_KEY) return { name: "OpenAI", key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || "gpt-4o-mini", url: "https://api.openai.com/v1/chat/completions" };
  return null;
}
