export type CallState = "Idle" | "Listening" | "Thinking" | "Speaking";
export interface Order {
  order_id: string; customer_name: string; product: string; value: number;
  status: "Processing" | "Shipped" | "Out for Delivery" | "Delivered" | "Cancelled";
  delivery_partner?: string; tracking_id?: string; delivery_notes: string;
  delivered_days_ago?: number;
}
export interface TranscriptEntry { id: string; role: "user" | "assistant"; content: string; timestamp: string; interrupted?: boolean }
export type Intent = "ORDER_TRACKING" | "CANCELLATION" | "RETURN_REQUEST" | "POLICY_QUESTION" | "OUT_OF_SCOPE" | "UNKNOWN";
export interface TurnOutcome { intent: Intent; order_id: string | null; resolution: "RESOLVED" | "POLICY_DECLINED" | "NEEDS_INFORMATION"; detail: string }
export interface CallSummary { customer_intent: string; order_id: string | null; resolution_status: string; call_summary: string }
export interface SessionData { expires: number; cancelled: string[]; outcomes: TurnOutcome[]; pending?: Intent; lastOrder?: string }
