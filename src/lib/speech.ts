export interface RecognitionResult { isFinal: boolean; 0: { transcript: string }; length: number }
export interface RecognitionEvent { resultIndex: number; results: { [index: number]: RecognitionResult; length: number } }
export interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function pickBrowserVoice<T extends { name: string; lang: string }>(voices: T[]): T | null {
  const feminine = /female|heera|neerja|aditi|priya|samantha|zira|jenny|aria|sonia|susan|hazel|salli|joanna|karen|moira|tessa|google uk english female/i;
  return voices.filter(v => v.lang.toLowerCase().startsWith("en")).sort((a, b) => {
    const score = (v: T) => (feminine.test(v.name) ? 100 : 0) + (v.lang.toLowerCase() === "en-in" ? 45 : 0) + (/natural|online|google/i.test(v.name) ? 15 : 0);
    return score(b) - score(a);
  })[0] || null;
}
export function createRecognition(): Recognition | null {
  const w = window as SpeechWindow;
  const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Constructor) return null;
  const recognition = new Constructor();
  recognition.lang = "en-IN"; recognition.continuous = true; recognition.interimResults = true;
  return recognition;
}
export class VoicePlayer {
  private epoch = 0;
  private audio?: HTMLAudioElement;
  private url?: string;
  private controller?: AbortController;
  private settle?: (completed: boolean) => void;
  private streamContext?: AudioContext;
  private streamSources: AudioBufferSourceNode[] = [];
  private streamTimer?: ReturnType<typeof setTimeout>;
  stop() {
    this.epoch++; this.controller?.abort(); this.controller = undefined;
    window.speechSynthesis?.cancel();
    if (this.streamTimer) clearTimeout(this.streamTimer);
    this.streamSources.forEach(source => { try { source.stop(); } catch { /* Already ended. */ } }); this.streamSources = [];
    if (this.streamContext) void this.streamContext.close(); this.streamContext = undefined;
    this.audio?.pause(); this.audio = undefined;
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined; this.settle?.(false); this.settle = undefined;
  }
  private async playStream(text: string, voice: AriaVoice, epoch: number, onPreparing?: (loading: boolean) => void): Promise<boolean> {
    this.controller = new AbortController();
    const response = await fetch("/api/tts-stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }), signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(55000)]) });
    if (!response.ok || !response.body) throw new Error("Streaming voice unavailable");
    const context = new AudioContext({ sampleRate: 24000 }); this.streamContext = context;
    await context.resume();
    const reader = response.body.getReader(); let nextTime = context.currentTime + .08, played = false, oddByte: number | undefined;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        if (epoch !== this.epoch) return false;
        let bytes = value;
        if (oddByte !== undefined) { bytes = new Uint8Array(value.length + 1); bytes[0] = oddByte; bytes.set(value, 1); oddByte = undefined; }
        if (bytes.length % 2) { oddByte = bytes[bytes.length - 1]; bytes = bytes.subarray(0, -1); }
        const samples = bytes.length / 2; if (!samples) continue;
        const buffer = context.createBuffer(1, samples, 24000); const channel = buffer.getChannelData(0);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let i = 0; i < samples; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
        const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
        nextTime = Math.max(nextTime, context.currentTime + .03); source.start(nextTime); nextTime += buffer.duration;
        this.streamSources.push(source); played = true; onPreparing?.(false);
      }
    } finally { await reader.cancel().catch(() => {}); }
    if (!played) throw new Error("No streaming audio returned");
    return new Promise<boolean>(resolve => {
      this.settle = resolve;
      this.streamTimer = setTimeout(() => { if (epoch === this.epoch) { this.settle = undefined; resolve(true); } }, Math.max(0, nextTime - context.currentTime) * 1000 + 100);
    });
  }
  async speak(text: string, cloud: boolean, onFallback: (reason: string) => void, voice: AriaVoice = "Aoede", onPreparing?: (loading: boolean) => void, preferStream = false): Promise<boolean> {
    this.stop(); const epoch = this.epoch;
    if (cloud) {
      onPreparing?.(true);
      if (preferStream && window.AudioContext) {
        try { const streamed = await this.playStream(text, voice, epoch, onPreparing); if (streamed || epoch !== this.epoch) return streamed; }
        catch { if (epoch !== this.epoch) return false; }
        if (this.streamContext) void this.streamContext.close(); this.streamContext = undefined; this.streamSources = [];
      }
      try {
        this.controller = new AbortController();
        const response = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }), signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(55000)]) });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Premium voice is unavailable. Using browser voice for now."); }
        const blob = await response.blob();
        if (epoch !== this.epoch) return false;
        this.url = URL.createObjectURL(blob); this.audio = new Audio(this.url);
        const audio = this.audio, url = this.url;
        const completed = await new Promise<boolean>((resolve) => {
          const finish = (success: boolean) => { URL.revokeObjectURL(url); if (epoch === this.epoch) { this.url = undefined; this.settle = undefined; this.audio = undefined; } resolve(success); };
          this.settle = resolve; audio.onplaying = () => { if (epoch === this.epoch) onPreparing?.(false); }; audio.onended = () => finish(true); audio.onerror = () => finish(false);
          audio.play().catch(() => finish(false));
        });
        if (completed || epoch !== this.epoch) return completed;
        onFallback("Premium audio could not play. Using browser voice for now.");
      } catch (error) { if (epoch !== this.epoch) return false; onFallback(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Premium voice took too long. Using browser voice for now."); }
      finally { if (epoch === this.epoch) onPreparing?.(false); }
    }
    if (epoch !== this.epoch || !window.speechSynthesis) return false;
    if (!window.speechSynthesis.getVoices().length) await new Promise<void>(resolve => { const ready = () => { clearTimeout(timer); window.speechSynthesis.removeEventListener("voiceschanged", ready); resolve(); }; const timer = setTimeout(ready, 750); window.speechSynthesis.addEventListener("voiceschanged", ready); });
    if (epoch !== this.epoch) return false;
    return new Promise<boolean>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      utterance.voice = pickBrowserVoice(voices);
      utterance.lang = utterance.voice?.lang || "en-IN"; utterance.rate = .96; utterance.pitch = 1.04; this.settle = resolve;
      utterance.onend = () => { if (epoch === this.epoch) this.settle = undefined; resolve(true); };
      utterance.onerror = () => { if (epoch === this.epoch) this.settle = undefined; resolve(false); };
      window.speechSynthesis.speak(utterance);
    });
  }
}
import type { AriaVoice } from "./voiceOptions";
