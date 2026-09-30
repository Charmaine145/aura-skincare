"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Check, Copy, FileJson, FileText, Phone, ShieldCheck } from "lucide-react";
import type { VoiceCall } from "@/hooks/useVoiceCall";
import { downloadFile, formatClock, formatMs, humanize } from "@/lib/format";
import type { CallSummary } from "@/types";
import { transcriptText } from "./Conversation";
import { Sheet } from "./ui/Sheet";

const TONE: Record<string, string> = { RESOLVED: "delivered", POLICY_DECLINED: "processing", NEEDS_INFORMATION: "transit", ESCALATED: "violet", UNRESOLVED: "cancelled", NO_CONVERSATION: "muted" };

/** Minimal JSON highlighter: keys, strings, numbers and literals. */
function highlight(json: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(json))) {
    if (match.index > last) out.push(json.slice(last, match.index));
    const [token, string, colon, literal, number] = match;
    const key = out.length;
    if (string && colon) out.push(<span key={key} className="j-key">{string}</span>, colon);
    else if (string) out.push(<span key={key} className="j-str">{string}</span>);
    else if (literal) out.push(<span key={key} className="j-lit">{literal}</span>);
    else if (number) out.push(<span key={key} className="j-num">{number}</span>);
    else out.push(token);
    last = match.index + token.length;
  }
  out.push(json.slice(last));
  return out;
}

function Overview({ summary }: { summary: CallSummary }) {
  const facts = [
    { label: "Intent", value: humanize(summary.customer_intent) },
    { label: "Order", value: <span className="mono">{summary.order_id ?? "—"}</span> },
    { label: "Resolution", value: <span className={`badge ${TONE[summary.resolution_status]}`}>{humanize(summary.resolution_status)}</span> },
    { label: "Sentiment", value: humanize(summary.customer_sentiment) },
  ];
  return (
    <div className="overview">
      <div className="facts">
        {facts.map((fact, i) => (
          <motion.div key={fact.label} className="fact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
          </motion.div>
        ))}
      </div>
      <p className="summary-text">{summary.call_summary}</p>
      {summary.issues.length > 0 && (
        <div className="summary-block">
          <h3>Issues handled</h3>
          <ul className="issues">
            {summary.issues.map((issue, i) => (
              <li key={i}>
                <span>{humanize(issue.intent)}{issue.order_id && <span className="mono"> · {issue.order_id}</span>}</span>
                <span className={`badge ${TONE[issue.resolution]}`}>{humanize(issue.resolution)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.actions_taken.length > 0 && (
        <div className="summary-block">
          <h3>Actions taken</h3>
          <ul className="actions">{summary.actions_taken.map(action => <li key={action}>{action}</li>)}</ul>
        </div>
      )}
      <p className="provenance">
        <ShieldCheck size={14} aria-hidden />
        {summary.generated_by === "rules"
          ? "Built from the server's verified tool log."
          : `Written by ${summary.generated_by}; order IDs, actions and outcomes come from the verified tool log.`}
      </p>
    </div>
  );
}

export function SummarySheet({ call, open, onClose }: { call: VoiceCall; open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"overview" | "json">("overview");
  const [copied, setCopied] = useState(false);
  const summary = call.summary;
  const json = summary ? JSON.stringify(summary, null, 2) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setTab("json");
    }
  };

  const meta = summary && [
    summary.metrics.duration_seconds !== null ? formatClock(summary.metrics.duration_seconds) : null,
    `${summary.metrics.customer_turns} ${summary.metrics.customer_turns === 1 ? "turn" : "turns"}`,
    `${summary.metrics.tool_calls} tool ${summary.metrics.tool_calls === 1 ? "call" : "calls"}`,
    summary.metrics.avg_response_ms !== null ? `avg response ${formatMs(summary.metrics.avg_response_ms)}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Sheet
      open={open && Boolean(summary)}
      onClose={onClose}
      width={760}
      title={
        <span className="sheet-title">
          Call summary <small>{meta}</small>
        </span>
      }
      footer={
        <>
          <button className="chip-btn labelled" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy JSON"}</button>
          <button className="chip-btn labelled" onClick={() => downloadFile(`${call.brand}-call-summary.json`, json, "application/json")}><FileJson size={14} /> JSON</button>
          <button className="chip-btn labelled" onClick={() => downloadFile(`${call.brand}-call-transcript.txt`, transcriptText(call.entries), "text/plain;charset=utf-8")}><FileText size={14} /> Transcript</button>
          <span className="spacer" />
          <button className="pill-btn small" onClick={() => { onClose(); void call.start(); }}><Phone size={15} /> New call</button>
        </>
      }
    >
      {summary && (
        <>
          <div className="tabs" role="tablist">
            {(["overview", "json"] as const).map(name => (
              <button key={name} role="tab" aria-selected={tab === name} className={tab === name ? "on" : ""} onClick={() => setTab(name)}>
                {tab === name && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span>{name === "overview" ? "Overview" : "JSON"}</span>
              </button>
            ))}
          </div>
          {tab === "overview" ? <Overview summary={summary} /> : <pre className="json" tabIndex={0}>{highlight(json)}</pre>}
        </>
      )}
    </Sheet>
  );
}
