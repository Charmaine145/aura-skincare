"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, Check, CheckCheck, ChevronRight, Copy, Headphones, Leaf, Mic, MicOff, Moon, Phone, PhoneOff, Send, ShieldCheck, Sparkles, Sun, Volume2, X } from "lucide-react";
import { orders } from "@/data/orders";
import { createRecognition, VoicePlayer, type Recognition } from "@/lib/speech";
import type { CallState, CallSummary, TranscriptEntry } from "@/types";
import { VoiceVisualizer } from "./VoiceVisualizer";
import { voiceOptions, voicePreviewText, type AriaVoice } from "@/lib/voiceOptions";
import { microphoneRms, VoiceActivityDetector } from "@/lib/voiceActivity";

const greeting = "Hi, I'm Aria, Aura Skincare's AI care specialist. How can I help you today?";
const stateCopy = { Idle: "Ready when you are", Listening: "I'm listening", Thinking: "Let me check that", Speaking: "Aria is speaking" };
const prompts = ["Where is my order ORD-101?", "Can I return ORD-102?", "Please cancel ORD-103"];

export function VoiceDesk() {
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(false), [state, setState] = useState<CallState>("Idle"), [muted, setMuted] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]), [draft, setDraft] = useState(""), [interim, setInterim] = useState("");
  const [notice, setNotice] = useState(""), [mode, setMode] = useState<"loading" | "ai" | "demo">("loading");
  const [cloudAvailable, setCloudAvailable] = useState(false), [cloud, setCloud] = useState(false), [dark, setDark] = useState(false);
  const [voice, setVoice] = useState<AriaVoice>("Aoede"), [provider, setProvider] = useState(""), [voiceProvider, setVoiceProvider] = useState("");
  const [previewing, setPreviewing] = useState(false), [voiceLoading, setVoiceLoading] = useState(false);
  const [autoInterrupt, setAutoInterrupt] = useState(true), [speechPath, setSpeechPath] = useState("Browser recognition");
  const [inputEngine, setInputEngine] = useState<"auto" | "gemini">("auto");
  const previewEpoch = useRef(0);
  const [summary, setSummary] = useState<CallSummary | null>(null), [summaryBusy, setSummaryBusy] = useState(false), [copied, setCopied] = useState(false);
  const [cancelled, setCancelled] = useState<string[]>([]), [elapsed, setElapsed] = useState(0), [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const activeRef = useRef(false), stateRef = useRef<CallState>("Idle"), mutedRef = useRef(false), textOnly = useRef(false);
  const fallbackMode = useRef(false), cloudTranscription = useRef(false), autoInterruptRef = useRef(true), speakingSince = useRef(0);
  const transcript = useRef<TranscriptEntry[]>([]), session = useRef<string | undefined>(undefined), epoch = useRef(0), speechEpoch = useRef(0);
  const recognition = useRef<Recognition | null>(null), player = useRef<VoicePlayer | null>(null), stream = useRef<MediaStream | null>(null), audioContext = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null), captured = useRef<Blob[]>([]), keepCapture = useRef(false), vadFrame = useRef(0), vad = useRef(new VoiceActivityDetector());
  const transcribeRequest = useRef<AbortController | null>(null);
  const request = useRef<AbortController | null>(null), restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null), bottom = useRef<HTMLDivElement>(null);
  const submitRef = useRef<(text: string, fromTranscription?: boolean) => Promise<void>>(async () => {});
  const setCallState = useCallback((value: CallState) => { stateRef.current = value; setState(value); }, []);
  const addEntry = useCallback((role: TranscriptEntry["role"], content: string) => {
    const entry = { id: crypto.randomUUID(), role, content, timestamp: new Date().toISOString() };
    transcript.current = [...transcript.current, entry]; setEntries(transcript.current); return entry.id;
  }, []);
  const markInterrupted = () => {
    const last = transcript.current.at(-1);
    if (last?.role === "assistant") { transcript.current = transcript.current.map(e => e.id === last.id ? { ...e, interrupted: true } : e); setEntries(transcript.current); }
  };
  const discardCapture = useCallback(() => {
    keepCapture.current = false;
    const current = recorder.current; recorder.current = null; captured.current = [];
    if (current?.state === "recording") current.stop();
    vad.current.reset();
  }, []);
  const capture = useCallback(() => {
    if (!stream.current || recorder.current || !activeRef.current || mutedRef.current || stateRef.current !== "Listening") return;
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { textOnly.current = true; setNotice("This browser cannot record audio for transcription. Please type your question."); return; }
    const current = new MediaRecorder(stream.current, { mimeType });
    recorder.current = current; captured.current = []; keepCapture.current = false;
    current.ondataavailable = event => { if (event.data.size) captured.current.push(event.data); };
    current.onstop = async () => {
      if (recorder.current !== current) return;
      recorder.current = null;
      const chunks = captured.current; captured.current = [];
      if (!keepCapture.current || !activeRef.current || stateRef.current !== "Listening") return;
      keepCapture.current = false; setCallState("Thinking"); setInterim("Transcribing your question…");
      const generation = epoch.current; transcribeRequest.current = new AbortController();
      try {
        const form = new FormData(); form.append("audio", new Blob(chunks, { type: mimeType.split(";")[0] }), "question.webm");
        const response = await fetch("/api/transcribe", { method: "POST", body: form, signal: transcribeRequest.current.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "I couldn't hear that clearly.");
        if (!activeRef.current || generation !== epoch.current) return;
        setInterim(""); void submitRef.current(data.text, true);
      } catch (error) {
        if (!activeRef.current || generation !== epoch.current) return;
        setInterim(""); setNotice(error instanceof Error ? error.message : "I couldn't hear that clearly. Please repeat that.");
        setCallState("Listening"); capture();
      }
    };
    current.start(250);
  }, [setCallState]);
  const listen = useCallback(() => {
    if (!activeRef.current || mutedRef.current || textOnly.current || stateRef.current !== "Listening") return;
    if (fallbackMode.current) { capture(); return; }
    try { recognition.current?.start(); } catch { /* Recognition may already be running. */ }
  }, [capture]);
  const runVad = useCallback((analyserNode: AnalyserNode) => {
    const data = new Uint8Array(analyserNode.fftSize);
    const tick = () => {
      if (!activeRef.current) return;
      const now = performance.now();
      const mode = mutedRef.current ? "idle" : stateRef.current === "Speaking" && autoInterruptRef.current && now - speakingSince.current > 500 ? "speaking" : stateRef.current === "Listening" && fallbackMode.current && recorder.current?.state === "recording" ? "recording" : "idle";
      const event = vad.current.update(mode, microphoneRms(analyserNode, data), now);
      if (event === "interrupt") { speechEpoch.current++; markInterrupted(); player.current?.stop(); setVoiceLoading(false); setCallState("Listening"); listen(); }
      if (event === "utterance_end" && recorder.current?.state === "recording") { keepCapture.current = true; recorder.current.stop(); }
      vadFrame.current = requestAnimationFrame(tick);
    };
    vadFrame.current = requestAnimationFrame(tick);
  }, [listen, setCallState]);
  const speak = useCallback(async (text: string, generation: number) => {
    if (!activeRef.current || generation !== epoch.current) return;
    const speechGeneration = ++speechEpoch.current;
    recognition.current?.abort(); discardCapture(); setInterim(""); speakingSince.current = performance.now(); setCallState("Speaking");
    player.current ??= new VoicePlayer();
    const completed = await player.current.speak(text, cloud, reason => setNotice(reason), voice, loading => { if (speechGeneration === speechEpoch.current && activeRef.current) setVoiceLoading(loading); }, voiceProvider === "Gemini");
    if (!activeRef.current || generation !== epoch.current || speechGeneration !== speechEpoch.current) return;
    if (!completed) setNotice("Audio was interrupted or could not play. The response is available in the transcript.");
    setCallState("Listening"); listen();
  }, [cloud, voice, voiceProvider, listen, setCallState, discardCapture]);
  const submit = useCallback(async (text: string, fromTranscription = false) => {
    const content = text.trim();
    if (!content || !activeRef.current || (stateRef.current === "Thinking" && !fromTranscription)) return;
    if (transcript.current.filter(e => e.role === "user").length >= 60) { setNotice("This call has reached 60 turns. End it to save a summary, then start a new call."); return; }
    if (stateRef.current === "Speaking") markInterrupted();
    speechEpoch.current++; setVoiceLoading(false); player.current?.stop(); recognition.current?.abort(); discardCapture(); setInterim(""); setDraft(""); setNotice("");
    const generation = epoch.current; addEntry("user", content); setCallState("Thinking");
    request.current = new AbortController();
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: transcript.current.map(({ role, content }) => ({ role, content })), session: session.current }), signal: request.current.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to get a response.");
      if (!activeRef.current || generation !== epoch.current) return;
      session.current = data.session; setMode(data.mode); setProvider(data.provider || ""); setCancelled(data.cancelled); addEntry("assistant", data.reply);
      await speak(data.reply, generation);
    } catch (error) {
      if (!activeRef.current || generation !== epoch.current) return;
      setNotice(error instanceof Error ? error.message : "The connection failed. Please try again.");
      setCallState("Listening"); listen();
    }
  }, [addEntry, listen, setCallState, speak, discardCapture]);
  useEffect(() => { submitRef.current = submit; }, [submit]);
  useEffect(() => {
    fetch("/api/config").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { setMode(data.mode); setProvider(data.provider || ""); setVoiceProvider(data.voiceProvider || ""); cloudTranscription.current = data.cloudTranscription; setCloudAvailable(data.cloudVoice); setCloud(data.cloudVoice); if (voiceOptions.some(v => v.id === data.defaultVoice)) setVoice(data.defaultVoice); }).catch(() => { setMode("demo"); setNotice("Unable to check the conversation service. Calls may be unavailable."); });
    window.speechSynthesis?.getVoices();
    return () => { activeRef.current = false; epoch.current++; request.current?.abort(); transcribeRequest.current?.abort(); recognition.current?.abort(); recorder.current?.stop(); player.current?.stop(); stream.current?.getTracks().forEach(t => t.stop()); void audioContext.current?.close(); cancelAnimationFrame(vadFrame.current); if (restartTimer.current) clearTimeout(restartTimer.current); };
  }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [entries, interim]);
  useEffect(() => { if (!active) return; const interval = setInterval(() => setElapsed(t => t + 1), 1000); return () => clearInterval(interval); }, [active]);

  async function start(useText = false) {
    if (activeRef.current || summaryBusy) return;
    previewEpoch.current++; player.current?.stop(); setPreviewing(false); setVoiceLoading(false);
    activeRef.current = true; const generation = ++epoch.current;
    textOnly.current = useText; setNotice(""); setSummary(null); session.current = undefined; transcript.current = []; setEntries([]); setCancelled([]); setElapsed(0); mutedRef.current = false; setMuted(false);
    if (!useText) {
      setStarting(true);
      try {
        const rec = inputEngine === "gemini" ? null : createRecognition();
        if (!rec && !(cloudTranscription.current && "MediaRecorder" in window)) throw new Error("Voice recognition isn't available in this browser. Try Chrome or Edge, or use a text call.");
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (!activeRef.current || generation !== epoch.current) { mic.getTracks().forEach(t => t.stop()); return; }
        stream.current = mic; const context = new AudioContext(); audioContext.current = context;
        const analyserNode = context.createAnalyser(); analyserNode.fftSize = 512; context.createMediaStreamSource(mic).connect(analyserNode); setAnalyser(analyserNode);
        fallbackMode.current = !rec; setSpeechPath(rec ? "Browser recognition" : "Gemini transcription");
        runVad(analyserNode);
        recognition.current = rec;
        if (rec) { rec.onresult = event => {
          if (!activeRef.current || mutedRef.current || stateRef.current !== "Listening") return;
          let final = "", partial = "";
          for (let i = event.resultIndex; i < event.results.length; i++) { const result = event.results[i]; if (result.isFinal) final += result[0].transcript; else partial += result[0].transcript; }
          setInterim(partial); if (final.trim()) void submitRef.current(final);
        };
        rec.onerror = event => {
          if (!activeRef.current || stateRef.current !== "Listening") return;
          if (event.error === "aborted") return;
          if (event.error === "no-speech") { setNotice("I couldn't hear that clearly. Please try again."); return; }
          if (["not-allowed", "service-not-allowed", "audio-capture", "network"].includes(event.error)) {
            if (cloudTranscription.current && "MediaRecorder" in window) { fallbackMode.current = true; setSpeechPath("Gemini transcription"); setNotice("Switched to Gemini transcription. Please repeat your question."); listen(); }
            else { textOnly.current = true; setNotice("Speech recognition is unavailable. You can continue this call by typing below."); }
          }
        };
        rec.onend = () => { if (activeRef.current && !fallbackMode.current && !textOnly.current && !mutedRef.current && stateRef.current === "Listening") restartTimer.current = setTimeout(listen, 250); }; }
      } catch (error) {
        if (generation !== epoch.current) return;
        activeRef.current = false; cancelAnimationFrame(vadFrame.current); setStarting(false); stream.current?.getTracks().forEach(t => t.stop()); void audioContext.current?.close(); setAnalyser(null);
        setNotice(error instanceof Error ? error.message : "Microphone access failed. You can use a text call."); return;
      }
    }
    setStarting(false);
    setActive(true); addEntry("assistant", greeting); await speak(greeting, generation);
  }
  function cancelStart() { activeRef.current = false; epoch.current++; cancelAnimationFrame(vadFrame.current); setStarting(false); setNotice("Microphone setup cancelled. You can start a text call instead."); }
  async function end() {
    if (!activeRef.current) return;
    if (stateRef.current === "Speaking") markInterrupted();
    activeRef.current = false; epoch.current++; request.current?.abort(); transcribeRequest.current?.abort(); recognition.current?.abort(); discardCapture(); cancelAnimationFrame(vadFrame.current); player.current?.stop();
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; void audioContext.current?.close(); audioContext.current = null;
    if (restartTimer.current) clearTimeout(restartTimer.current);
    setAnalyser(null); setActive(false); setVoiceLoading(false); setInterim(""); setCallState("Idle"); setSummaryBusy(true); setNotice("");
    try {
      const response = await fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: session.current }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setSummary(data);
    } catch { setNotice("The summary couldn't be verified. Your transcript is still available to download."); }
    finally { setSummaryBusy(false); }
  }
  function toggleMute() {
    const value = !mutedRef.current; mutedRef.current = value; setMuted(value);
    stream.current?.getAudioTracks().forEach(t => { t.enabled = !value; });
    if (value) { recognition.current?.abort(); discardCapture(); setInterim(""); } else listen();
  }
  function interrupt() { speechEpoch.current++; setVoiceLoading(false); markInterrupted(); player.current?.stop(); setCallState("Listening"); setNotice(""); listen(); }
  async function previewVoice() {
    if (activeRef.current) return;
    const generation = ++previewEpoch.current;
    player.current ??= new VoicePlayer();
    if (previewing) { player.current.stop(); setPreviewing(false); setVoiceLoading(false); return; }
    setPreviewing(true); setNotice("");
    const completed = await player.current.speak(voicePreviewText, cloud, reason => setNotice(reason), voice, loading => { if (generation === previewEpoch.current) setVoiceLoading(loading); }, voiceProvider === "Gemini");
    if (generation !== previewEpoch.current || activeRef.current) return;
    setPreviewing(false); setVoiceLoading(false);
    if (!completed) setNotice("The voice preview couldn't play. Please try again.");
  }
  function download() {
    const text = transcript.current.map(e => `[${new Date(e.timestamp).toLocaleTimeString("en-IN")}] ${e.role === "user" ? "Customer" : "Aria"}: ${e.content}${e.interrupted ? " [audio interrupted]" : ""}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "aura-call-transcript.txt"; link.click(); URL.revokeObjectURL(url);
  }
  async function copySummary() { try { await navigator.clipboard.writeText(JSON.stringify(summary, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setNotice("Clipboard access is unavailable. Select and copy the JSON below."); } }
  const time = `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;

  return <div className={`app-shell ${dark ? "dark" : ""}`}>
    <header className="brand-header"><a className="brand" href="/" aria-label="Aura Skincare home"><span className="brand-symbol"><Leaf size={23} strokeWidth={1.4} /></span><span>aura<span className="brand-subtitle">S K I N C A R E</span></span></a><div className="header-right"><span className="care-label">A little care goes a long way.</span><button className="icon-button" onClick={() => setDark(!dark)} aria-label={dark ? "Use light theme" : "Use dark theme"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button></div></header>
    <main>
      <div className="intro"><div><div className="eyebrow"><span /> THE AURA CARE EXPERIENCE</div><h1>Good care starts with<br />a <em>conversation.</em></h1><p>Meet Aria. Your personal guide to orders, policies,<br className="desktop-break" /> and a little more peace of mind.</p></div><div className="intro-note"><Headphones size={21} strokeWidth={1.4} /><span>Thoughtful support.<br /><strong>Just a conversation away.</strong></span></div></div>
      <div className="workspace-grid">
        <section className="voice-panel panel" aria-label="Voice call controls">
          <div className="panel-top"><span className="label">YOUR CARE SPECIALIST</span><span className={`availability ${active ? "on-call" : ""}`}><span />{active ? `In a call · ${time}` : "Ready to help"}</span></div>
          <div className={`orb-area state-${state.toLowerCase()}`}><div className="orb-halo halo-outer" /><div className="orb-halo halo-inner" /><div className="orb"><div className="orb-shine" /><Sparkles size={47} strokeWidth={0.8} /></div><div className="ai-badge"><Sparkles size={11} /> AI</div></div>
          <h2>Aria</h2><p className="agent-description">Your Aura care companion</p>
          <VoiceVisualizer state={state} analyser={analyser} />
          <div className={`state-badge state-${state.toLowerCase()}`} aria-live="polite"><span />{voiceLoading ? "Preparing Aria's voice…" : muted && state === "Listening" ? "Microphone muted" : stateCopy[state]}</div>
          <div className="call-controls">{active ? <><button className="mute-button" onClick={toggleMute} disabled={textOnly.current} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff size={20} /> : <Mic size={20} />}</button><button className="end-button" onClick={() => void end()}><PhoneOff size={18} /> End call</button></> : <button className="start-button" onClick={() => void start()} disabled={starting || summaryBusy || mode === "loading"}><Phone size={18} />{starting ? "Waiting for microphone…" : "Start call"}<ArrowRight size={17} /></button>}</div>
          {starting ? <button className="text-link" onClick={cancelStart}>Cancel microphone setup</button> : active && state === "Speaking" ? <button className="text-link" onClick={interrupt}>Interrupt &amp; speak</button> : !active ? <button className="text-link" disabled={summaryBusy} onClick={() => void start(true)}>Prefer to type? Start a text call</button> : <p className="call-hint">{textOnly.current ? "Type your question in the conversation." : "Speak naturally. Aria is here to help."}</p>}
          <div className="voice-settings"><Volume2 size={15} /><label htmlFor="voice">Voice</label><select id="voice" value={cloud ? voice : "browser"} onChange={e => { previewEpoch.current++; player.current?.stop(); setPreviewing(false); setVoiceLoading(false); setCloud(e.target.value !== "browser"); if (e.target.value !== "browser") setVoice(e.target.value as AriaVoice); }} disabled={active || starting || mode === "loading"}>{voiceProvider === "Gemini" ? voiceOptions.map(v => <option key={v.id} value={v.id}>{v.label}</option>) : <option value="Aoede" disabled={!cloudAvailable}>Aria · premium voice</option>}<option value="browser">Browser · instant fallback</option></select><button className="preview-voice" onClick={() => void previewVoice()} disabled={active || starting || mode === "loading"}>{previewing ? "Stop" : "Preview"}</button></div>
          <div className="audio-preferences"><label>Microphone <select value={inputEngine} disabled={active || starting} onChange={e => setInputEngine(e.target.value as "auto" | "gemini")}><option value="auto">Automatic</option><option value="gemini" disabled={!cloudTranscription.current}>Gemini · clearer speech</option></select></label><label className="interrupt-toggle"><input type="checkbox" checked={autoInterrupt} disabled={active && textOnly.current} onChange={e => { setAutoInterrupt(e.target.checked); autoInterruptRef.current = e.target.checked; }} /> Let me interrupt Aria</label></div>
          <p className="voice-quality-note">{cloud ? "A warm female voice, with natural pauses." : "Voice quality depends on your browser."}</p>
          {active && !textOnly.current && <p className="voice-quality-note">Listening with {speechPath.toLowerCase()}.</p>}
          <div className="privacy-note"><ShieldCheck size={13} /><span>Microphone stops when your call ends.</span></div>
        </section>
        <section className="conversation-panel panel" aria-label="Conversation transcript"><div className="panel-top"><div className="conversation-title"><span className="label">THE CONVERSATION</span><span className="live-pill">{active ? "LIVE" : entries.length ? "CALL ENDED" : "TRANSCRIPT"}</span></div><button className="icon-button" disabled={!entries.length} onClick={download} aria-label="Download transcript"><ArrowDownToLine size={17} /></button></div>
          <div className="transcript-scroll" role="log" aria-live="polite">{entries.length ? entries.map(entry => <div key={entry.id} className={`message ${entry.role}`}><div className="message-meta"><span>{entry.role === "assistant" ? "ARIA" : "YOU"}</span><time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time></div><div className="bubble">{entry.content}</div>{entry.interrupted && <span className="interrupted">Audio interrupted</span>}</div>) : <div className="empty-transcript"><div className="empty-icon"><Leaf size={27} strokeWidth={1.2} /></div><h3>A space for your questions.</h3><p>Start a call and your conversation<br />will appear here, as it happens.</p><span className="empty-line" /></div>}{interim && <div className="interim">{interim}…</div>}{state === "Thinking" && <div className="typing-indicator"><span /><span /><span /><small>Aria is checking</small></div>}<div ref={bottom} /></div>
          <div className="conversation-bottom"><form onSubmit={e => { e.preventDefault(); void submit(draft); }}><input aria-label="Type your question" placeholder={active ? "Or type your question here…" : "Start a call to ask a question…"} value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} disabled={!active || state === "Thinking"} /><button type="submit" aria-label="Send message" disabled={!active || !draft.trim() || state === "Thinking"}><Send size={18} /></button></form><span><CheckCheck size={13} /> Your transcript and summary will be ready after the call.</span></div>
        </section>
      </div>
      {notice && <div className="notice" role="status"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={16} /></button></div>}
      <section className="test-section"><div className="section-heading"><div><span className="eyebrow">TRY A CONVERSATION</span><h3>A few orders to get you started.</h3></div><span className="sample-label">SAMPLE ORDERS · DEMO DATA</span></div><div className="order-grid">{orders.map((order, i) => <article className="order-card" key={order.order_id}><div className="order-top"><span className="order-id">{order.order_id}</span><span className={`order-status status-${i}`}>{cancelled.includes(order.order_id) ? "Cancelled" : order.status}</span></div><h4>{order.product}</h4><div className="order-customer">{order.customer_name}<span>₹{order.value}</span></div><p>{cancelled.includes(order.order_id) ? "Cancelled in this demo call" : order.delivery_notes}</p><button disabled={!active || state === "Thinking"} onClick={() => void submit(prompts[i])}>{["Track this order", "Check return eligibility", "Cancel this order"][i]}<ChevronRight size={15} /></button></article>)}</div><p className="test-hint">You can also ask about shipping, returns, or Cash on Delivery. Sample orders reset for every new call.</p></section>
      {summaryBusy && <div className="summary-loading" role="status">Preparing your call summary…</div>}
      {summary && <section className="summary-panel panel"><div className="panel-top"><div><span className="eyebrow">CALL COMPLETE</span><h3>Your care conversation, captured.</h3></div><button className="outline-button" onClick={() => void copySummary()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy JSON"}</button></div><pre>{JSON.stringify(summary, null, 2)}</pre><button className="text-link" onClick={download}><ArrowDownToLine size={14} /> Download chronological transcript</button></section>}
      <footer><span><Leaf size={14} /> Pure. Effective. Conscious.</span><span>{mode === "ai" ? `AI conversation · ${provider}` : mode === "demo" ? "Rule-based demo · Add an API key for natural conversation" : "Checking conversation service…"}</span><span>Aura Skincare © {new Date().getFullYear()}</span></footer>
    </main>
  </div>;
}
