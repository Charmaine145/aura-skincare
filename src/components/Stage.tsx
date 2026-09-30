"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Hand, Keyboard, LoaderCircle, Mic, MicOff, Phone, PhoneOff, Play, Settings2, Square } from "lucide-react";
import type { VoiceCall } from "@/hooks/useVoiceCall";
import { formatClock } from "@/lib/format";
import { useBrowserVoices } from "@/hooks/useBrowserVoices";
import { EDGE_TIP, isEdge, isNaturalVoice } from "@/lib/voice/browserVoices";
import { brandById } from "@/data/brand";
import { Orb } from "./Orb";

function status(call: VoiceCall): { title: string; detail: string; tone: string } {
  if (call.phase === "starting") return { title: "Connecting", detail: "Allow microphone access to begin", tone: "idle" };
  if (call.phase === "ending") return { title: "Wrapping up", detail: "Writing your call summary", tone: "thinking" };
  if (call.phase !== "live") return { title: "Ready when you are", detail: "Start a call and speak naturally", tone: "idle" };
  switch (call.agentState) {
    case "Listening":
      return { title: "Listening", detail: call.textMode ? "Type your message" : call.muted ? "Microphone is muted" : "Go ahead, I'm listening", tone: "listening" };
    case "Thinking":
      return { title: "Thinking", detail: call.statusLabel || "One moment", tone: "thinking" };
    case "Speaking":
      return { title: "Speaking", detail: call.bargeIn && !call.textMode ? "Talk anytime to interrupt" : "", tone: "speaking" };
    default:
      return { title: "Connecting", detail: "", tone: "idle" };
  }
}

function Settings({ call, onClose }: { call: VoiceCall; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const idle = call.phase === "idle";
  const report = useBrowserVoices();
  const chosen = report.find(r => r.code === call.language);
  const premium = Boolean(call.config?.voiceProvider);
  // The server's natural voice for this language, if Aria will use one (Edge, Azure or Sarvam).
  const serverVoice = premium && call.voice !== "browser"
    ? call.language === "en-IN" ? call.config?.voices.find(v => v.id === call.voice)?.label : call.config?.voiceLanguages?.[call.language]
    : undefined;
  const [inEdge, setInEdge] = useState(true);
  useEffect(() => setInEdge(isEdge()), []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node) && !(event.target as HTMLElement).closest(".settings-trigger")) onClose();
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="popover"
      role="dialog"
      aria-label="Language and voice settings"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      <label className="field">
        <span>Language</span>
        <div className="field-row">
          <select className="select" value={call.language} disabled={!idle} onChange={e => call.setLanguage(e.target.value)}>
            {report.map(r => (
              <option key={r.code} value={r.code}>{r.code === "en-IN" ? r.native : `${r.native} · ${r.label}`}</option>
            ))}
          </select>
          <button className="chip-btn" onClick={() => void call.previewVoice()} disabled={!idle} aria-label={call.previewing ? "Stop preview" : "Hear Aria in this language"}>
            {call.previewing ? <Square size={13} /> : <Play size={13} />}
          </button>
        </div>
        {serverVoice ? (
          <small>Natural voice: {serverVoice}</small>
        ) : (
          <small className={chosen?.voice ? "" : "warn-text"}>
            {chosen?.voice ? `Voice on this device: ${chosen.voice}` : `No ${chosen?.label} voice installed on this device.`}
            {!inEdge && !(chosen?.voice && isNaturalVoice(chosen.voice)) && <> {EDGE_TIP}</>}
          </small>
        )}
      </label>
      {premium && (
        <label className="field">
          <span>Aria&apos;s voice</span>
          <select className="select" value={call.voice} disabled={!idle} onChange={e => call.setVoice(e.target.value)}>
            {call.config?.voices.map(v => (
              <option key={v.id} value={v.id}>{`${v.label} · ${v.description}`}</option>
            ))}
            <option value="browser">This device&apos;s voice</option>
          </select>
        </label>
      )}
      <label className="field">
        <span>Speech recognition</span>
        <select className="select" value={call.inputEngine} disabled={!idle} onChange={e => call.setInputEngine(e.target.value as "auto" | "gemini")}>
          <option value="auto">Browser · fastest</option>
          <option value="gemini" disabled={!call.config?.cloudTranscription}>Gemini · any browser</option>
        </select>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={call.bargeIn} onChange={e => call.setBargeIn(e.target.checked)} />
        <span className="toggle-track" aria-hidden />
        <span>
          Interrupt by speaking
          <small>Turn off on loudspeakers if Aria stops by herself.</small>
        </span>
      </label>
      <details className="voice-list">
        <summary>Voices on this device</summary>
        <ul>
          {report.map(r => (
            <li key={r.code} className={r.voice ? "" : "missing"}>
              <span>{r.label}</span>
              <span>{r.voice ?? "not installed"}</span>
            </li>
          ))}
        </ul>
      </details>
    </motion.div>
  );
}

export function Stage({ call }: { call: VoiceCall }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { phase } = call;
  const live = phase === "live";
  const current = status(call);
  const orbState = live ? call.agentState : phase === "ending" ? "Thinking" : "Idle";

  return (
    <section className="stage" aria-label="Call">
      <div className="orb-wrap">
        <Orb state={orbState} mic={call.micAnalyser} output={call.outputAnalyser} />
      </div>

      <div className="identity">
        <h1>Aria</h1>
        <p>{brandById(call.brand).name} · AI care specialist</p>
      </div>

      <div className="status" role="status" aria-live="polite" data-tone={current.tone}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${current.title}|${current.detail}`}
            className="status-inner"
            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
            transition={{ duration: 0.22 }}
          >
            <span className="status-title">
              <span className="status-dot" />
              {current.title}
              {live && <span className="status-clock">{formatClock(call.elapsed)}</span>}
            </span>
            {current.detail && <span className={`status-detail ${current.tone === "thinking" ? "shiny" : ""}`}>{current.detail}</span>}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="controls">
        {phase === "idle" && (
          <>
            <motion.button className="start-btn" onClick={() => void call.start()} disabled={!call.config} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <span className="start-glow" aria-hidden />
              <Phone size={18} /> Start call
            </motion.button>
          </>
        )}
        {phase === "starting" && (
          <button className="pill-btn ghost" onClick={() => void call.end()}>
            <LoaderCircle size={17} className="spin" /> Cancel
          </button>
        )}
        {live && (
          <>
            {!call.textMode && (
              <button className={`round-btn ${call.muted ? "danger-soft" : ""}`} onClick={call.toggleMute} aria-label={call.muted ? "Unmute" : "Mute"} aria-pressed={call.muted} title={call.muted ? "Unmute" : "Mute"}>
                {call.muted ? <MicOff size={19} /> : <Mic size={19} />}
              </button>
            )}
            <motion.button className="pill-btn danger" onClick={() => void call.end()} whileTap={{ scale: 0.96 }}>
              <PhoneOff size={18} /> End
            </motion.button>
            <AnimatePresence>
              {call.agentState === "Speaking" && (
                <motion.button
                  className="round-btn"
                  onClick={call.interrupt}
                  aria-label="Interrupt Aria"
                  title="Interrupt"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                >
                  <Hand size={19} />
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}
        {phase === "ending" && (
          <button className="pill-btn ghost" disabled>
            <LoaderCircle size={17} className="spin" /> Wrapping up
          </button>
        )}
        <div className="settings-anchor">
          <button className="round-btn settings-trigger" onClick={() => setSettingsOpen(open => !open)} aria-label="Voice settings" aria-expanded={settingsOpen} title="Voice settings">
            <Settings2 size={18} />
          </button>
          <AnimatePresence>{settingsOpen && <Settings call={call} onClose={() => setSettingsOpen(false)} />}</AnimatePresence>
        </div>
      </div>

      {phase === "idle" && (
        <button className="text-btn" onClick={() => void call.start({ text: true })} disabled={!call.config}>
          <Keyboard size={15} /> No microphone? Chat by text
        </button>
      )}
    </section>
  );
}
