import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "../src/lib/rateLimit";
test("provider requests are bounded per visitor and endpoint", () => {
  const request = new Request("http://localhost/api/chat", { headers: { "x-vercel-forwarded-for": `test-${crypto.randomUUID()}` } });
  for (let i = 0; i < 80; i++) assert.equal(checkRateLimit(request, "chat"), true);
  assert.equal(checkRateLimit(request, "chat"), false);
  assert.equal(checkRateLimit(request, "tts"), true);
});
