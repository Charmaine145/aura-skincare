export class VoiceActivityDetector {
  private mode = "";
  private speechSince = 0;
  private lastVoice = 0;
  private hasSpeech = false;
  reset() { this.mode = ""; this.speechSince = 0; this.lastVoice = 0; this.hasSpeech = false; }
  update(mode: "speaking" | "recording" | "idle", rms: number, now: number): "interrupt" | "utterance_end" | null {
    if (mode !== this.mode) { this.mode = mode; this.speechSince = 0; this.lastVoice = 0; this.hasSpeech = false; }
    if (mode === "idle") return null;
    const threshold = mode === "speaking" ? 0.055 : 0.023;
    if (rms > threshold) {
      this.lastVoice = now;
      if (!this.speechSince) this.speechSince = now;
      if (now - this.speechSince >= (mode === "speaking" ? 210 : 120)) this.hasSpeech = true;
      if (mode === "speaking" && this.hasSpeech) { this.reset(); return "interrupt"; }
      return null;
    }
    this.speechSince = 0;
    if (mode === "recording" && this.hasSpeech && now - this.lastVoice >= 800) { this.reset(); return "utterance_end"; }
    return null;
  }
}
export function microphoneRms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const value of buffer) { const centered = (value - 128) / 128; sum += centered * centered; }
  return Math.sqrt(sum / buffer.length);
}
