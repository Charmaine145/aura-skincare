import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SessionData } from "@/types";
// Local fallback survives hot reload; production must configure a shared secret.
const scope = globalThis as typeof globalThis & { ariaSecret?: string };
const secret = process.env.SESSION_SECRET || (scope.ariaSecret ??= randomBytes(32).toString("hex"));
export function newSession(): SessionData { return { expires: Date.now() + 60 * 60 * 1000, cancelled: [], outcomes: [] }; }
export function signSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function readSession(token?: string): SessionData {
  if (!token) return newSession();
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Invalid call session. Start a new call.");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("Invalid call session. Start a new call.");
  const data: SessionData = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (data.expires < Date.now()) throw new Error("This call session has expired. Start a new call.");
  return data;
}
