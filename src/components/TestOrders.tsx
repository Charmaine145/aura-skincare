"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { brandById } from "@/data/brand";
import type { VoiceCall } from "@/hooks/useVoiceCall";
import type { OrderStatus } from "@/types";

const TONE: Record<OrderStatus, string> = {
  "Out for Delivery": "transit",
  Shipped: "transit",
  Delivered: "delivered",
  Processing: "processing",
  Cancelled: "cancelled",
};

const ACTIONS = [
  { label: "Track", prompt: (id: string) => `Where is my order ${id}?` },
  { label: "Return", prompt: (id: string) => `Can I return ${id}?` },
  { label: "Cancel", prompt: (id: string) => `Please cancel ${id}.` },
];

/** The brief's "Test Orders Helper": every sample order and its details, one tap from a question. */
export function TestOrders({ call }: { call: VoiceCall }) {
  const [copied, setCopied] = useState<string | null>(null);
  const busy = !call.config || call.phase === "starting" || call.phase === "ending" || (call.phase === "live" && call.agentState === "Thinking");

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      setTimeout(() => setCopied(current => (current === id ? null : current)), 1400);
    } catch {
      // Clipboard unavailable; the ID is on screen anyway.
    }
  };

  return (
    <section className="orders" aria-label="Test orders">
      <header className="orders-head">
        <span>Test orders</span>
        <small>Sample data · resets each call</small>
      </header>
      <ul>
        {brandById(call.brand).orders.map((order, i) => {
          const cancelled = call.cancelled.includes(order.order_id);
          const status: OrderStatus = cancelled ? "Cancelled" : order.status;
          return (
            <motion.li key={order.order_id} className="order" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.07 }}>
              <div className="order-line">
                <button className="order-id" onClick={() => void copy(order.order_id)} title="Copy order ID">
                  {order.order_id}
                  {copied === order.order_id ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <span className="order-product">{order.product}</span>
                <span className="order-value">₹{order.value.toLocaleString("en-IN")}</span>
                <motion.span key={status} className={`badge ${TONE[status]}`} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  {status}
                </motion.span>
              </div>
              <div className="order-sub">
                {order.customer_name}
                {order.courier && <> · {order.courier} {order.tracking_id}</>} · {cancelled ? "Cancelled during this call" : order.notes}
              </div>
              <div className="order-actions">
                {ACTIONS.map(action => (
                  <button key={action.label} disabled={busy} onClick={() => call.ask(action.prompt(order.order_id))}>
                    {action.label}
                  </button>
                ))}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
