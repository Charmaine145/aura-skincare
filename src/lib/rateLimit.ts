const windows = new Map<string, { count: number; resetAt: number }>();
const limits = { chat: 80, tts: 40, transcription: 40 } as const;
export function checkRateLimit(request: Request, kind: keyof typeof limits): boolean {
  const now = Date.now();
  if (windows.size > 5000) for (const [key, value] of windows) if (value.resetAt < now) windows.delete(key);
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${kind}:${ip}`;
  const existing = windows.get(key);
  if (!existing || existing.resetAt < now) { windows.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 }); return true; }
  if (existing.count >= limits[kind]) return false;
  existing.count++; return true;
}
