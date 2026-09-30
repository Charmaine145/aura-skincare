"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownToLine, ArrowUp, Banknote, FileText, Keyboard, Mic, PackageSearch, RotateCcw, Sparkles, XCircle } from "lucide-react";
import type { TranscriptEntry, VoiceCall } from "@/hooks/useVoiceCall";
import { brandById, sampleIds, type Brand } from "@/data/brand";
import { downloadFile, formatMs, formatTime } from "@/lib/format";
import { BlurText } from "./ui/BlurText";

function suggestionsFor(brand: Brand) {
  const ids = sampleIds(brand);
  return [
    { icon: PackageSearch, title: "Track an order", prompt: `Where is my order ${ids.track}?` },
    { icon: RotateCcw, title: "Ask about a return", prompt: `Can I return ${ids.returnable}?` },
    { icon: XCircle, title: "Cancel an order", prompt: `Please cancel my order ${ids.cancellable}.` },
    { icon: Banknote, title: "Cash on Delivery", prompt: "Is Cash on Delivery available?" },
  ];
}

export function scenariosFor(brand: Brand) {
  const ids = sampleIds(brand);
  return [
    `Where is my order ${ids.track}?`,
    `Can I return ${ids.returnable}?`,
    `Please cancel my order ${ids.cancellable}.`,
    "I bought this 20 days ago and have opened it. Can I return it?",
    "Where is my order ORD-999?",
    `Can you cancel ${ids.track}?`,
    "Is Cash on Delivery available?",
    "Can you book me a flight to Goa?",
    `Mera order ${ids.track} kab tak aayega?`,
    "Can I talk to a real person?",
  ];
}

export function transcriptText(entries: TranscriptEntry[]): string {
  return entries
    .map(e => `[${new Date(e.timestamp).toLocaleTimeString("en-IN")}] ${e.role === "user" ? "Customer" : "Aria"}: ${e.content}${e.interrupted ? " [interrupted]" : ""}`)
    .join("\n\n");
}

function Message({ entry, animate }: { entry: TranscriptEntry; animate: boolean }) {
  const aria = entry.role === "assistant";
  const tools = [...new Set(entry.tools ?? [])];
  return (
    <motion.div
      className={`msg ${aria ? "aria" : "user"}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      <div className="msg-text">{aria && animate ? <BlurText text={entry.content} /> : entry.content}</div>
      <div className="msg-meta">
        <time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
        {entry.via === "voice" && <Mic size={11} aria-label="spoken" />}
        {entry.via === "text" && <Keyboard size={11} aria-label="typed" />}
        {entry.latencyMs !== undefined && <span title="From the end of your turn to Aria's first word">{formatMs(entry.latencyMs)}</span>}
        {tools.map(tool => (
          <span key={tool} className="meta-tool">{tool}</span>
        ))}
        {entry.source === "policy" && <span className="meta-policy">policy</span>}
        {entry.source === "direct" && <span className="meta-policy" title="Answered from the verified order record, without a model call">instant</span>}
        {entry.interrupted && <span>interrupted</span>}
      </div>
    </motion.div>
  );
}

export function Conversation({ call, onShowSummary }: { call: VoiceCall; onShowSummary: () => void }) {
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const live = call.phase === "live";
  const thinking = live && call.agentState === "Thinking";
  const busy = !call.config || call.phase === "starting" || call.phase === "ending" || thinking;

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [call.entries, call.interim, thinking]);

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    call.ask(text);
    setDraft("");
    setMenuOpen(false);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  return (
    <section className="conversation" aria-label="Conversation">
      <header className="conversation-head">
        <span className="conversation-title">
          Conversation
          {live && <span className="live-dot">Live</span>}
        </span>
        <div className="conversation-actions">
          {call.summary && call.phase === "idle" && (
            <button className="chip-btn labelled" onClick={onShowSummary}>
              <FileText size={14} /> Summary
            </button>
          )}
          <button className="icon-btn" disabled={!call.entries.length} onClick={() => downloadFile(`${call.brand}-call-transcript.txt`, transcriptText(call.entries), "text/plain;charset=utf-8")} aria-label="Download transcript" title="Download transcript">
            <ArrowDownToLine size={16} />
          </button>
        </div>
      </header>

      <div className="transcript" ref={scroller} role="log" aria-live="polite" aria-relevant="additions">
        {call.entries.length === 0 ? (
          <div className="empty">
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              How can Aria help?
            </motion.h2>
            <p>Start a call and just talk, or tap a question to try it by text.</p>
            <div className="suggestions">
              {suggestionsFor(brandById(call.brand)).map(({ icon: Icon, title, prompt }, i) => (
                <motion.button
                  key={title}
                  className="suggestion"
                  onClick={() => send(prompt)}
                  disabled={busy}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  whileHover={{ y: -2 }}
                >
                  <Icon size={18} aria-hidden />
                  <span className="suggestion-title">{title}</span>
                  <span className="suggestion-prompt">“{prompt}”</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          // Motion animates on mount only, so each reply gets its word-by-word entrance exactly once.
          call.entries.map(entry => <Message key={entry.id} entry={entry} animate={live} />)
        )}
        <AnimatePresence>
          {call.interim && (
            <motion.div className="msg user interim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="msg-text">{call.interim}</div>
            </motion.div>
          )}
          {thinking && (
            <motion.div className="thinking" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span className="dots"><i /><i /><i /></span>
              <span className="shiny">{call.statusLabel || "Thinking"}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <form className="composer" onSubmit={submit}>
        <div className="try-anchor">
          <button type="button" className="icon-btn" onClick={() => setMenuOpen(open => !open)} aria-label="Test scenarios" aria-expanded={menuOpen} title="Test scenarios" disabled={busy}>
            <Sparkles size={16} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.ul className="scenario-menu" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16 }}>
                <li className="scenario-menu-title">Test scenarios</li>
                {scenariosFor(brandById(call.brand)).map(prompt => (
                  <li key={prompt}>
                    <button type="button" onClick={() => send(prompt)}>{prompt}</button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
        <input
          aria-label="Message Aria"
          placeholder={live ? "Type a message…" : "Type to start a chat…"}
          value={draft}
          maxLength={2000}
          onChange={e => setDraft(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="send-btn" aria-label="Send" disabled={!draft.trim() || busy}>
          <ArrowUp size={17} />
        </button>
      </form>
    </section>
  );
}
