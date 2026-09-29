import type { CallSummary, SessionData } from "@/types";
export function summarize(session: SessionData): CallSummary {
  const outcomes = session.outcomes;
  const relevant = outcomes.filter(o => o.intent !== "UNKNOWN");
  const latest = relevant.at(-1) || outcomes.at(-1);
  const ids = [...new Set(relevant.map(o => o.order_id).filter(Boolean))];
  const intents = [...new Set(relevant.map(o => o.intent))];
  return { customer_intent: intents.length > 1 ? "MULTIPLE_INTENTS" : latest?.intent || "UNKNOWN", order_id: ids.length === 1 ? ids[0]! : null,
    resolution_status: outcomes.length === 0 ? "NO_CONVERSATION" : latest?.resolution || "NEEDS_INFORMATION",
    call_summary: outcomes.length === 0 ? "The call ended without a customer question." : relevant.length ? relevant.map(o => o.detail).join(" ") : outcomes.map(o => o.detail).join(" ") };
}
