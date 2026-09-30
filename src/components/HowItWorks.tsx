"use client";

import { Ban, Brain, CircleCheck, Ear, FileJson, Fingerprint, Gavel, Linkedin, MessageSquareQuote, Volume2, Wrench } from "lucide-react";
import { policyCards, type Brand } from "@/data/brand";
import { Sheet } from "./ui/Sheet";

const PIPELINE = [
  { icon: Ear, title: "Listen", text: "Browser speech recognition in Indian English, with Gemini transcription as a fallback." },
  { icon: Brain, title: "Understand", text: "Gemini with native function calling decides when a question needs a tool." },
  { icon: Wrench, title: "Act safely", text: "Server-side tools look up orders and apply the return and cancellation policies in code." },
  { icon: Volume2, title: "Speak", text: "Microsoft's natural Indian voices in every language, with Sarvam and the browser's own voice as fallbacks." },
  { icon: FileJson, title: "Summarise", text: "A JSON record written from the transcript and checked against the verified tool log." },
];

const GUARDRAILS = [
  { icon: Gavel, title: "Decisions in code", text: "Return windows, damage deadlines and cancellation rules are computed on the server." },
  { icon: MessageSquareQuote, title: "Verbatim refusals", text: "Policy decisions are spoken exactly as the server words them." },
  { icon: Fingerprint, title: "No invented order IDs", text: "A tool call is blocked unless the customer actually said that ID." },
  { icon: CircleCheck, title: "Confirm before acting", text: "Cancelling needs an explicit yes, handled in code." },
  { icon: Ban, title: "Stays in scope", text: "Off-topic requests are declined politely and steered back to the brand." },
];

export function HowItWorks({ brand, open, onClose }: { brand: Brand; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} width={720} title="How Aria works">
      <ol className="how-steps">
        {PIPELINE.map(({ icon: Icon, title, text }, i) => (
          <li key={title}>
            <span className="how-num">{i + 1}</span>
            <Icon size={17} aria-hidden />
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="how-sub">Guardrails</h3>
      <ul className="how-guards">
        {GUARDRAILS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Icon size={16} aria-hidden />
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ul>
      <h3 className="how-sub">{brand.name} policies Aria enforces</h3>
      <dl className="how-policies">
        {policyCards(brand).map(policy => (
          <div key={policy.id}>
            <dt>{policy.title}</dt>
            <dd>{policy.text}</dd>
          </div>
        ))}
      </dl>
      <p className="how-credit">
        Aura Skincare and Veda Haircare are fictional and all orders are sample data. Built by Aditya Acharya ·{" "}
        <a href="https://www.linkedin.com/in/adityaacharyax/" target="_blank" rel="noreferrer"><Linkedin size={12} aria-hidden /> LinkedIn</a>
      </p>
    </Sheet>
  );
}
