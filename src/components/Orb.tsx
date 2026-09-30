"use client";

import { useEffect, useRef } from "react";
import type { AgentState } from "@/types";

/**
 * Aria's orb: a WebGL fluid sphere (in the spirit of React Bits' <Orb />). Its palette and speed
 * follow the call state, and its surface breathes with real audio: the caller's microphone while
 * listening, Aria's own voice output while speaking.
 */

type Rgb = [number, number, number];
const hex = (value: string): Rgb => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255) as Rgb;

const PALETTES: Record<AgentState, { colors: [Rgb, Rgb, Rgb]; speed: number }> = {
  Idle: { colors: [hex("#8fb9a0"), hex("#f4dcc8"), hex("#cfe6d8")], speed: 0.35 },
  Listening: { colors: [hex("#27a77b"), hex("#a6ecd0"), hex("#17664f")], speed: 0.6 },
  Thinking: { colors: [hex("#e2a444"), hex("#f9e3ae"), hex("#c06f2a")], speed: 1.5 },
  Speaking: { colors: [hex("#8a66db"), hex("#f2a9cc"), hex("#5a7de3")], speed: 0.95 },
};

const VERTEX = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAGMENT = `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uLevel;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                 mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                 mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y) * 2.0;
  float r = length(p);
  float angle = atan(p.y, p.x);

  // A living edge: slow noise, pushed outward by audio level.
  float wobble = (noise(vec3(cos(angle) * 1.6, sin(angle) * 1.6, uTime * 0.7)) - 0.5) * (0.06 + uLevel * 0.22);
  float radius = 0.72 + wobble + uLevel * 0.07;
  float inside = smoothstep(radius + 0.012, radius - 0.012, r);

  // Fluid colour inside the sphere (domain-warped noise).
  vec2 q = p * 1.25;
  float n1 = fbm(vec3(q, uTime * 0.32));
  float n2 = fbm(vec3(q * 1.6 + n1 * 1.4, uTime * 0.45 + 4.0));
  vec3 color = mix(uColorA, uColorB, smoothstep(0.25, 0.8, n1));
  color = mix(color, uColorC, smoothstep(0.35, 0.85, n2) * 0.75);

  // Spherical shading, rim light and a soft specular highlight.
  float depth = sqrt(max(0.0, 1.0 - pow(r / radius, 2.0)));
  color *= 0.78 + 0.3 * depth;
  color += smoothstep(radius - 0.22, radius, r) * inside * 0.22 * uColorB;
  vec2 h = p - vec2(-0.26, 0.3);
  color += exp(-dot(h, h) * 10.0) * 0.32;
  color = clamp(color, 0.0, 1.0);

  // Outer glow that swells when there's sound.
  // (faded to zero before the canvas edge so no square outline shows on dark backgrounds)
  float glow = exp(-max(r - radius, 0.0) * 7.0) * (1.0 - inside) * (0.28 + uLevel * 0.55) * smoothstep(0.98, 0.8, r);
  vec3 glowColor = mix(uColorA, uColorB, 0.45);
  float alpha = clamp(inside + glow, 0.0, 1.0);
  gl_FragColor = vec4(color * inside + glowColor * glow, alpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function rms(analyser: AnalyserNode, buffer: Uint8Array<ArrayBuffer>) {
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const value of buffer) sum += ((value - 128) / 128) ** 2;
  return Math.sqrt(sum / buffer.length);
}

export function Orb({ state, mic, output }: { state: AgentState; mic: AnalyserNode | null; output: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const audio = useRef({ mic, output });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    audio.current = { mic, output };
  }, [mic, output]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!canvas || !gl) {
      canvas?.parentElement?.classList.add("orb-fallback");
      return;
    }
    const program = gl.createProgram()!;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) {
      canvas.parentElement?.classList.add("orb-fallback");
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uResolution = uniform("uResolution");
    const uTime = uniform("uTime");
    const uLevel = uniform("uLevel");
    const uColors = [uniform("uColorA"), uniform("uColorB"), uniform("uColorC")];

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const colors = PALETTES.Idle.colors.map(c => [...c]) as Rgb[];
    const samples = new Uint8Array(256);
    let speed = PALETTES.Idle.speed;
    let clock = 0;
    let level = 0;
    let last = performance.now();
    let frame = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(canvas.clientWidth * ratio);
      const height = Math.round(canvas.clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = stateRef.current;
      const palette = PALETTES[current];
      // Ease the palette and speed toward the current state for smooth transitions.
      const ease = 1 - Math.exp(-dt * 4);
      for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) colors[i][c] += (palette.colors[i][c] - colors[i][c]) * ease;
      speed += (palette.speed - speed) * ease;
      clock += dt * (reduceMotion ? 0.15 : speed);

      const source = current === "Listening" ? audio.current.mic : current === "Speaking" ? audio.current.output : null;
      let target = source ? Math.min(1, rms(source, samples) * 4.5) : 0;
      if (!source && current === "Speaking") target = 0.25 + 0.15 * Math.sin(now / 160); // browser voice can't be measured
      if (current === "Thinking") target = 0.12 + 0.08 * Math.sin(now / 260);
      level += (target - level) * (target > level ? 0.35 : 0.08);

      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, clock);
      gl.uniform1f(uLevel, reduceMotion ? 0 : level);
      uColors.forEach((location, i) => gl.uniform3fv(location, colors[i]));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    // (No loseContext() here: React's dev double-mount would reuse the same, now dead, context.)
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="orb" data-state={state}>
      <canvas ref={canvasRef} aria-hidden />
    </div>
  );
}
