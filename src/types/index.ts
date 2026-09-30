export type AgentState = "Idle" | "Listening" | "Thinking" | "Speaking";

export type OrderStatus = "Processing" | "Shipped" | "Out for Delivery" | "Delivered" | "Cancelled";

export interface Order {
  order_id: string;
  customer_name: string;
  product: string;
  /** Order value in rupees. */
  value: number;
  status: OrderStatus;
  courier?: string;
  tracking_id?: string;
  notes: string;
  ordered_hours_ago?: number;
  delivered_days_ago?: number;
}

export type Intent =
  | "ORDER_TRACKING"
  | "CANCELLATION"
  | "RETURN_REQUEST"
  | "DAMAGED_PRODUCT"
  | "POLICY_QUESTION"
  | "HUMAN_HANDOFF"
  | "OUT_OF_SCOPE"
  | "GENERAL";

export type Resolution = "RESOLVED" | "POLICY_DECLINED" | "NEEDS_INFORMATION" | "ESCALATED" | "UNRESOLVED";

/** One verified thing that happened in a call. Written by the server, never by the model. */
export interface TurnOutcome {
  intent: Intent;
  order_id: string | null;
  resolution: Resolution;
  /** Third-person fact, e.g. "Cancelled ORD-103 after the customer confirmed." */
  detail: string;
}

export interface Escalation {
  reference: string;
  reason: string;
  order_id: string | null;
}

/** Per-call state. Travels between browser and server inside an HMAC-signed token. */
export interface SessionData {
  v: 2;
  expires: number;
  /** Brand this call is for (a BrandId); fixed for the whole call. Absent in older tokens: Aura. */
  brand?: string;
  cancelled: string[];
  outcomes: TurnOutcome[];
  escalations: Escalation[];
  toolCalls: number;
  lastOrder?: string;
  /** Order waiting for the customer's yes/no before it is cancelled. */
  pendingCancel?: string;
  /** Rule-based mode only: the request that is waiting for an order ID. */
  pendingIntent?: Intent;
}

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type ToolName = "get_order_details" | "cancel_order" | "check_return_eligibility" | "escalate_to_human";
export type ToolStatus = "ok" | "not_found" | "declined" | "needs_info" | "confirm" | "done" | "blocked" | "error";

/** Events streamed from /api/chat while Aria works on a turn. */
export type AgentEvent =
  | { type: "tool_call"; id: string; name: ToolName; args: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: ToolName; status: ToolStatus; summary: string; ms: number }
  | { type: "guardrail"; rule: string; detail: string }
  | { type: "model"; model: string; round: number; ms: number };

/** model: worded by the LLM · policy: a server policy decision · direct: facts from a lookup, no model call · rules: keyless demo mode. */
export type ReplySource = "model" | "policy" | "direct" | "rules";

export type ChatStreamEvent =
  | AgentEvent
  | { type: "reply"; text: string; source: ReplySource }
  | { type: "done"; session: string; mode: "ai" | "demo"; cancelled: string[]; endCall: boolean; ms: number }
  | { type: "error"; message: string };

export interface CallSummary {
  /** Brand the call was for. */
  brand: string;
  customer_intent: Intent;
  order_id: string | null;
  resolution_status: Resolution | "NO_CONVERSATION";
  call_summary: string;
  customer_sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  follow_up_required: boolean;
  issues: { intent: Intent; order_id: string | null; resolution: Resolution }[];
  actions_taken: string[];
  order_ids: string[];
  metrics: { customer_turns: number; tool_calls: number; duration_seconds: number | null; avg_response_ms: number | null };
  generated_by: string;
}

export type VoiceProviderId = "edge" | "azure" | "sarvam" | "openai" | "gemini";

export interface AppConfig {
  mode: "ai" | "demo";
  provider: string | null;
  model: string | null;
  modelLabel: string | null;
  /** First configured premium voice provider; null means the browser's own voice. */
  voiceProvider: VoiceProviderId | null;
  voices: { id: string; label: string; description: string }[];
  defaultVoice: string | null;
  /** Natural server voice for each Indian language it covers, e.g. { "hi-IN": "Swara" }. */
  voiceLanguages: Record<string, string>;
  cloudTranscription: boolean;
}
