import { z } from "zod";
import { aiReply, demoReply } from "@/lib/conversation";
import { readSession, signSession } from "@/lib/session";
import { historySchema, readBody } from "@/lib/validation";
import { conversationProvider } from "@/lib/provider";
import { checkRateLimit } from "@/lib/rateLimit";
export const runtime = "nodejs";
const schema = z.object({ messages: historySchema, session: z.string().max(60000).optional() }).strict();
export async function POST(request: Request) {
  if (!checkRateLimit(request, "chat")) return Response.json({ error: "This browser has reached the demo call limit for now. Please try again later." }, { status: 429 });
  try {
    const input = schema.parse(await readBody(request));
    if (input.messages.at(-1)?.role !== "user") return Response.json({ error: "A customer message is required." }, { status: 400 });
    const session = readSession(input.session);
    if (session.outcomes.length >= 100) return Response.json({ error: "Please end this call and start a new one." }, { status: 400 });
    const provider = conversationProvider();
    const isAI = Boolean(provider);
    const reply = isAI ? await aiReply(input.messages, session) : demoReply(input.messages.at(-1)!.content, session);
    return Response.json({ reply, session: signSession(session), mode: isAI ? "ai" : "demo", provider: provider?.name, cancelled: session.cancelled });
  } catch (error) {
    const validation = error instanceof z.ZodError || error instanceof SyntaxError;
    return Response.json({ error: validation ? "Invalid request. Please use a shorter question." : error instanceof Error ? error.message : "Something went wrong." }, { status: validation ? 400 : 503 });
  }
}
