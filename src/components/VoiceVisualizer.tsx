"use client";
import { useEffect, useRef } from "react";
import type { CallState } from "@/types";
export function VoiceVisualizer({ state, analyser }: { state: CallState; analyser: AnalyserNode | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d"); if (!context) return;
    let frame = 0;
    const data = new Uint8Array(analyser?.frequencyBinCount || 128);
    const draw = (time: number) => {
      context.clearRect(0, 0, 320, 76);
      if (analyser) analyser.getByteFrequencyData(data);
      for (let i = 0; i < 45; i++) {
        const energy = analyser && state === "Listening" ? data[i] / 255 : state === "Speaking" ? (Math.sin(time / 150 + i * 0.8) + 1) / 3 : state === "Thinking" ? (Math.sin(time / 350 + i * 0.3) + 1) / 8 : 0.04;
        const height = 5 + Math.sin((i / 44) * Math.PI) * (8 + energy * 48);
        context.fillStyle = state === "Thinking" ? "#a7804e" : "#59745e";
        context.beginPath(); context.roundRect(i * 7 + 3, (76 - height) / 2, 3, height, 2); context.fill();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw); return () => cancelAnimationFrame(frame);
  }, [state, analyser]);
  return <canvas ref={canvas} width={320} height={76} className="waveform" aria-label={state === "Listening" ? "Microphone frequency visualizer" : "Animated voice activity indicator"} />;
}
