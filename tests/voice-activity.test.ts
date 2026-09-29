import { test } from "node:test";
import assert from "node:assert/strict";
import { VoiceActivityDetector } from "../src/lib/voiceActivity";
test("brief noise does not interrupt the agent", () => {
  const vad = new VoiceActivityDetector();
  assert.equal(vad.update("speaking", .08, 1000), null);
  assert.equal(vad.update("speaking", .01, 1050), null);
  assert.equal(vad.update("speaking", .08, 1100), null);
  assert.equal(vad.update("speaking", .08, 1250), null);
  assert.equal(vad.update("speaking", .08, 1320), "interrupt");
});
test("fallback recording waits for speech then a clear silence", () => {
  const vad = new VoiceActivityDetector();
  assert.equal(vad.update("recording", .01, 1000), null);
  assert.equal(vad.update("recording", .03, 1200), null);
  assert.equal(vad.update("recording", .03, 1350), null);
  assert.equal(vad.update("recording", .01, 1800), null);
  assert.equal(vad.update("recording", .01, 2150), "utterance_end");
});
