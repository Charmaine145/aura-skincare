import { z } from "zod";
import { orders } from "@/data/orders";
import type { SessionData } from "@/types";
export function normalizeOrderId(input: string): string {
  const words: Record<string, string> = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
  const cleaned = input.toLowerCase().replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine)\b/g, w => words[w]).replace(/\b(one hundred and one)\b/g, "101").replace(/[^a-z0-9]/g, "");
  const match = cleaned.match(/(?:ord|order)?(\d{3,})/);
  return match ? `ORD-${match[1]}` : input.trim().toUpperCase();
}
export function getOrderDetails(id: string, session: SessionData) {
  const normalized = normalizeOrderId(id);
  const order = orders.find(o => o.order_id === normalized);
  if (!order) return null;
  return session.cancelled.includes(normalized) ? { ...order, status: "Cancelled" as const, delivery_notes: "Cancelled during this demo call" } : { ...order };
}
export function cancelOrder(id: string, session: SessionData) {
  const order = getOrderDetails(id, session);
  if (!order) return { ok: false, message: "I couldn't find that order. Could you verify or spell out the ID?" };
  if (order.status === "Cancelled") return { ok: true, message: `${order.order_id} is already cancelled in this demo call.` };
  if (order.status !== "Processing") return { ok: false, message: `Order ${order.order_id} is ${order.status.toLowerCase()}, so it cannot be cancelled. ${["Shipped", "Out for Delivery"].includes(order.status) ? "You may refuse it at the doorstep." : "Only orders still processing can be cancelled."}` };
  session.cancelled.push(order.order_id);
  return { ok: true, message: `I've cancelled ${order.order_id} in this demo call. This is a sample order; no real payment or order was changed.` };
}
export interface ReturnFacts { is_opened?: boolean; is_unused?: boolean; original_packaging?: boolean; is_damaged?: boolean; photos_available?: boolean }
export function checkReturnEligibility(id: string, facts: ReturnFacts, session: SessionData) {
  const order = getOrderDetails(id, session);
  if (!order) return { eligible: false, needs_information: true, message: "I couldn't find that order. Could you verify the ID?" };
  if (order.status !== "Delivered" || order.delivered_days_ago === undefined) return { eligible: false, message: "Returns can be assessed after delivery. This order has not been delivered." };
  if (facts.is_damaged) {
    if (order.delivered_days_ago > 2) return { eligible: false, message: "Damage must be reported within 48 hours of delivery with photos. This order is outside that window, so I cannot promise a replacement." };
    if (facts.photos_available !== true) return { eligible: false, needs_information: true, message: "Damage reported within 48 hours qualifies for replacement with photos. Do you have photos of the damage?" };
    return { eligible: true, message: "This meets the damage reporting window. Photos are required for a replacement; this demo cannot collect photos or book a replacement." };
  }
  if (order.delivered_days_ago > 7) return { eligible: false, message: `This order was delivered ${order.delivered_days_ago} days ago, outside our 7-day return window. I can't approve a return or refund, but I can help with general usage questions.` };
  if (facts.is_opened === true || facts.is_unused === false || facts.original_packaging === false) return { eligible: false, message: "Returns require an unopened, unused product in its original packaging. I can't approve this return, but I can help with general usage questions." };
  if (facts.is_opened === undefined || facts.is_unused === undefined || facts.original_packaging === undefined) return { eligible: false, needs_information: true, message: "Is the product unopened, unused, and in its original packaging? All three are required for a return within 7 days." };
  return { eligible: true, message: "This meets our return eligibility policy. This demo can check eligibility, but cannot book a pickup or issue a refund." };
}
export const toolSchemas = {
  get_order_details: z.object({ order_id: z.string().max(100) }).strict(),
  cancel_order: z.object({ order_id: z.string().max(100), reason: z.string().max(300).optional() }).strict(),
  check_return_eligibility: z.object({ order_id: z.string().max(100), is_opened: z.boolean().optional(), is_unused: z.boolean().optional(), original_packaging: z.boolean().optional(), is_damaged: z.boolean().optional(), photos_available: z.boolean().optional() }).strict(),
};
export const toolDefinitions = Object.entries(toolSchemas).map(([name]) => ({ type: "function", function: {
  name, description: name === "get_order_details" ? "Retrieve the exact sample order details. Always call before quoting status." : name === "cancel_order" ? "Cancel a demo order only after an explicit customer cancellation request. Server enforces Processing-only policy." : "Evaluate return or damage policy. Omit unknown facts; never guess.",
  parameters: { type: "object", properties: { order_id: { type: "string" }, ...(name === "cancel_order" ? { reason: { type: "string" } } : {}), ...(name === "check_return_eligibility" ? Object.fromEntries(["is_opened", "is_unused", "original_packaging", "is_damaged", "photos_available"].map(key => [key, { type: "boolean" }])) : {}) }, required: ["order_id"], additionalProperties: false },
} }));
