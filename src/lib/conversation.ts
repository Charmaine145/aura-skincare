import type { Intent, SessionData, TurnOutcome } from "@/types";
import { cancelOrder, checkReturnEligibility, getOrderDetails, normalizeOrderId, toolDefinitions, toolSchemas } from "./tools";
import { systemPrompt } from "./prompt";
import { conversationProvider } from "./provider";

export function detectIntent(text: string): Intent {
  if (/\b(don't|do not|never|not to)\s+cancel/i.test(text)) return "UNKNOWN";
  if (/cancel|radd/i.test(text)) return "CANCELLATION";
  if (/return|refund|replace|damaged|defective|opened/i.test(text)) return "RETURN_REQUEST";
  if (/where|track|status|deliver.*ord|order.*deliver|bata|kab tak/i.test(text)) return "ORDER_TRACKING";
  if (/ship|delivery|cod|cash|upi|payment|policy|charge|skincare|aura/i.test(text)) return "POLICY_QUESTION";
  if (/flight|weather|politic|recipe|code|football/i.test(text)) return "OUT_OF_SCOPE";
  return "UNKNOWN";
}
export function appendOutcome(session: SessionData, outcome: TurnOutcome) {
  session.outcomes.push(outcome);
  // Bounded tokens; client limits calls to 60 customer turns, so no outcomes are dropped.
  if (outcome.order_id) session.lastOrder = outcome.order_id;
  session.pending = outcome.resolution === "NEEDS_INFORMATION" ? outcome.intent : undefined;
}
export function demoReply(text: string, session: SessionData): string {
  if (/\b(don't|do not|never|not to)\s+cancel/i.test(text)) {
    session.pending = undefined;
    appendOutcome(session, { intent: "CANCELLATION", order_id: null, resolution: "RESOLVED", detail: "No cancellation was performed." });
    return "Of course. I won't cancel your order.";
  }
  let intent = detectIntent(text);
  if (intent === "UNKNOWN" && session.pending) intent = session.pending;
  const normalized = normalizeOrderId(text);
  const explicitId = /^ORD-\d+$/.test(normalized) ? normalized : undefined;
  if (intent === "UNKNOWN" && explicitId) intent = "ORDER_TRACKING";
  const id = explicitId || (/\b(it|that order|this order)\b/i.test(text) || session.pending ? session.lastOrder : undefined);
  const finish = (reply: string, resolution: TurnOutcome["resolution"], order_id: string | null = id || null) => {
    appendOutcome(session, { intent, order_id, resolution, detail: reply }); return reply;
  };
  if (["ORDER_TRACKING", "CANCELLATION", "RETURN_REQUEST"].includes(intent)) {
    if (!id) {
      if (intent === "RETURN_REQUEST" && /\b(opened|used)\b/i.test(text) && !/unopened|unused|not opened/i.test(text)) return finish("Returns require an unopened, unused product in its original packaging within 7 days of delivery. I can't approve a return for an opened product.", "POLICY_DECLINED");
      return finish("Could you share your order ID, such as O R D, one zero one?", "NEEDS_INFORMATION");
    }
    const order = getOrderDetails(id, session);
    if (!order) return finish("I couldn't find an order with that ID. Could you verify the number or spell it out?", "NEEDS_INFORMATION");
    if (intent === "CANCELLATION") { const result = cancelOrder(id, session); return finish(result.message, result.ok ? "RESOLVED" : "POLICY_DECLINED"); }
    if (intent === "RETURN_REQUEST") {
      const result = checkReturnEligibility(id, { is_opened: /unopened|not opened/i.test(text) ? false : /opened/i.test(text) ? true : undefined, is_unused: /unused/i.test(text) ? true : /\bused\b/i.test(text) ? false : undefined, original_packaging: /original packaging/i.test(text) ? true : undefined, is_damaged: /damaged|defective/i.test(text) || undefined }, session);
      return finish(result.message, result.needs_information ? "NEEDS_INFORMATION" : result.eligible ? "RESOLVED" : "POLICY_DECLINED");
    }
    return finish(`${order.order_id}, ${order.product}, is ${order.status.toLowerCase()}. ${order.delivery_partner ? `Your courier is ${order.delivery_partner}, tracking ${order.tracking_id}. ` : ""}${order.delivery_notes}.`, "RESOLVED");
  }
  if (/cod|cash|upi|payment/i.test(text)) return finish("Cash on Delivery is available up to 2,500 rupees. You can pay by cash or UPI at your doorstep.", "RESOLVED", null);
  if (/ship|delivery|charge/i.test(text)) return finish("Delivery takes 3 to 5 business days, with free shipping above 499 rupees and a 50 rupee fee below that. The supplied policy doesn't specify the fee at exactly 499 rupees.", "RESOLVED", null);
  if (/policy/i.test(text)) return finish("Returns are accepted within 7 days for unopened, unused products in original packaging. Damage must be reported within 48 hours with photos for replacement.", "RESOLVED", null);
  if (intent === "OUT_OF_SCOPE") return finish("I can help with Aura Skincare orders and policies. Is there something about your skincare order I can help with?", "POLICY_DECLINED", null);
  if (/hello|hi\b|namaste|thank/i.test(text)) return finish("I'm here to help. You can ask about an Aura order, returns, shipping, or Cash on Delivery.", "NEEDS_INFORMATION", null);
  return finish("I couldn't quite understand that. Could you repeat your Aura order or policy question?", "NEEDS_INFORMATION", null);
}

type GeminiPart = { text?: string; functionCall?: { id?: string; name: string; args: Record<string, unknown> }; thoughtSignature?: string };
type Message = { role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string; geminiParts?: GeminiPart[] };
type ToolCall = { id: string; function: { name: string; arguments: string } };
function geminiRequest(messages: Message[], model: string) {
  const names = new Map<string, string>();
  for (const message of messages) for (const call of message.tool_calls || []) names.set(call.id, call.function.name);
  return { systemInstruction: { parts: [{ text: messages.filter(m => m.role === "system").map(m => m.content).join("\n\n") }] },
    contents: messages.filter(m => m.role !== "system").map(m => m.role === "tool" ? { role: "user", parts: [{ functionResponse: { name: names.get(m.tool_call_id!), response: JSON.parse(m.content!) } }] } : { role: m.role === "assistant" ? "model" : "user", parts: m.geminiParts || [{ text: m.content || "" }] }),
    tools: [{ functionDeclarations: toolDefinitions.map(t => ({ name: t.function.name, description: t.function.description, parametersJsonSchema: t.function.parameters })) }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1024, thinkingConfig: model.startsWith("gemini-2.5-flash") ? { thinkingBudget: 0 } : { thinkingLevel: "LOW" } },
  };
}
export async function aiReply(history: { role: "user" | "assistant"; content: string }[], session: SessionData) {
  const provider = conversationProvider();
  if (!provider) throw new Error("No conversation provider is configured.");
  const messages: Message[] = [{ role: "system", content: systemPrompt }, { role: "system", content: `Call state: ${JSON.stringify({ cancelled: session.cancelled, lastOrder: session.lastOrder, pending: session.pending })}` }, ...history];
  let authoritativeReply: string | undefined;
  let usedTool = false;
  const current = history.at(-1)!.content;
  const cancellationAuthorized = !/\b(don't|do not|never|not to)\s+cancel/i.test(current) && (detectIntent(current) === "CANCELLATION" || (session.pending === "CANCELLATION" && /^ORD-\d+$/.test(normalizeOrderId(current)) && detectIntent(current) !== "RETURN_REQUEST"));
  const currentId = normalizeOrderId(current);
  const suppliedId = /^ORD-\d+$/.test(currentId) ? currentId : [...history].reverse().filter(m => m.role === "user").map(m => normalizeOrderId(m.content)).find(id => /^ORD-\d+$/.test(id));
  for (let round = 0; round < 4; round++) {
    const gemini = provider.name === "Gemini";
    const options = (model: string): RequestInit => ({ method: "POST", headers: gemini ? { "x-goog-api-key": provider.key, "Content-Type": "application/json" } : { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" }, body: JSON.stringify(gemini ? geminiRequest(messages, model) : { model, messages, tools: toolDefinitions, parallel_tool_calls: false, temperature: 0.3, max_tokens: 512 }), signal: AbortSignal.timeout(20000) });
    let response = await fetch(gemini ? `${provider.url}${encodeURIComponent(provider.model)}:generateContent` : provider.url, options(provider.model));
    if (gemini && response.status === 503 && provider.model !== "gemini-3.1-flash-lite") response = await fetch(`${provider.url}gemini-3.1-flash-lite:generateContent`, options("gemini-3.1-flash-lite"));
    if (!response.ok) {
      if (process.env.ARIA_PROVIDER_DEBUG === "1") {
        const details = await response.text();
        console.error("Conversation provider response", response.status, details.replaceAll(provider.key, "[redacted]").slice(0, 1800));
      }
      throw new Error(response.status === 403 ? `${provider.name} access is disabled for this API key. Add a valid key to the server to restore AI conversation.` : response.status === 429 ? `${provider.name} has reached its usage limit. Please try again shortly.` : `${provider.name} is temporarily unavailable. Please try again.`);
    }
    const payload = await response.json();
    const parts: GeminiPart[] | undefined = gemini ? payload.candidates?.[0]?.content?.parts : undefined;
    const message: Message | undefined = gemini ? parts ? { role: "assistant", content: parts.filter(p => p.text).map(p => p.text).join(""), geminiParts: parts, tool_calls: parts.filter(p => p.functionCall).map((p, i) => ({ id: p.functionCall!.id || `call_${round}_${i}`, function: { name: p.functionCall!.name, arguments: JSON.stringify(p.functionCall!.args) } })) } : undefined : payload.choices?.[0]?.message;
    if (!message) throw new Error("The conversation provider returned an empty response.");
    if (!message.tool_calls?.length) {
      const reply = authoritativeReply || message.content?.trim();
      if (!reply) throw new Error("The conversation provider returned an empty response.");
      if (!authoritativeReply && !usedTool) { const intent = detectIntent(current); appendOutcome(session, { intent, order_id: null, resolution: intent === "OUT_OF_SCOPE" ? "POLICY_DECLINED" : "NEEDS_INFORMATION", detail: reply }); }
      if (usedTool && !authoritativeReply && session.outcomes.length) session.outcomes[session.outcomes.length - 1].detail = reply;
      return reply;
    }
    messages.push(message);
    for (const call of message.tool_calls) {
      let result: unknown;
      const args = JSON.parse(call.function.arguments);
      if (typeof args.order_id === "string" && (!suppliedId || normalizeOrderId(args.order_id) !== suppliedId)) {
        const reply = "Could you share or verify the order ID you want me to check?";
        appendOutcome(session, { intent: detectIntent(current), order_id: null, resolution: "NEEDS_INFORMATION", detail: reply });
        return reply;
      }
      if (call.function.name === "get_order_details") {
        usedTool = true;
        const parsed = toolSchemas.get_order_details.parse(args);
        const order = getOrderDetails(parsed.order_id, session);
        result = order || { error: "Order not found. Ask customer to verify ID." };
        if (order) session.lastOrder = order.order_id;
        appendOutcome(session, { intent: "ORDER_TRACKING", order_id: normalizeOrderId(parsed.order_id), resolution: order ? "RESOLVED" : "NEEDS_INFORMATION", detail: order ? `${order.order_id} is ${order.status}. ${order.delivery_notes}.` : "Order not found; ID clarification needed." });
      } else if (call.function.name === "cancel_order") {
        const parsed = toolSchemas.cancel_order.parse(args);
        // Do not permit mutation merely because the model decides to call a tool.
        const authorized = cancellationAuthorized;
        const outcome = authorized ? cancelOrder(parsed.order_id, session) : { ok: false, message: "Please explicitly ask to cancel the order before I change it." };
        result = outcome; authoritativeReply = outcome.message;
        appendOutcome(session, { intent: "CANCELLATION", order_id: normalizeOrderId(parsed.order_id), resolution: outcome.ok ? "RESOLVED" : authorized ? "POLICY_DECLINED" : "NEEDS_INFORMATION", detail: outcome.message });
      } else if (call.function.name === "check_return_eligibility") {
        const parsed = toolSchemas.check_return_eligibility.parse(args);
        const outcome = checkReturnEligibility(parsed.order_id, parsed, session);
        result = outcome; authoritativeReply = outcome.message;
        appendOutcome(session, { intent: "RETURN_REQUEST", order_id: normalizeOrderId(parsed.order_id), resolution: outcome.needs_information ? "NEEDS_INFORMATION" : outcome.eligible ? "RESOLVED" : "POLICY_DECLINED", detail: outcome.message });
      } else result = { error: "Unknown tool" };
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
    // Action/policy results are spoken verbatim, so the LLM cannot turn a denial into a promise.
    if (authoritativeReply) return authoritativeReply;
  }
  throw new Error("I couldn't complete that lookup. Please try a shorter question.");
}
