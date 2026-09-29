import { test } from "node:test";
import assert from "node:assert/strict";
import { orders } from "../src/data/orders";
import { cancelOrder, checkReturnEligibility, getOrderDetails, normalizeOrderId } from "../src/lib/tools";
import { newSession, readSession, signSession } from "../src/lib/session";
import { demoReply, detectIntent } from "../src/lib/conversation";
import { summarize } from "../src/lib/summary";

test("recognizes spoken digits and IDs without matching 101 inside 1010", () => {
  assert.equal(normalizeOrderId("O R D one zero one"), "ORD-101");
  assert.equal(getOrderDetails("ORD-1010", newSession()), null);
});
test("only Processing can cancel, and cancellation is isolated to a call", () => {
  const session = newSession();
  assert.equal(cancelOrder("ORD-101", session).ok, false);
  assert.equal(cancelOrder("ORD-102", session).ok, false);
  assert.equal(cancelOrder("ORD-103", session).ok, true);
  assert.equal(getOrderDetails("ORD-103", session)?.status, "Cancelled");
  assert.equal(getOrderDetails("ORD-103", newSession())?.status, "Processing");
  assert.equal(cancelOrder("ORD-103", session).ok, true);
});
test("late returns and damage claims are declined", () => {
  assert.equal(checkReturnEligibility("ORD-102", { is_opened: false }, newSession()).eligible, false);
  assert.equal(checkReturnEligibility("ORD-102", { is_damaged: true }, newSession()).eligible, false);
  assert.equal(checkReturnEligibility("ORD-999", {}, newSession()).needs_information, true);
});
test("return boundaries require all facts and damage photos", () => {
  const original = orders[1].delivered_days_ago;
  try {
    orders[1].delivered_days_ago = 7;
    assert.equal(checkReturnEligibility("ORD-102", {}, newSession()).needs_information, true);
    assert.equal(checkReturnEligibility("ORD-102", { is_opened: false, is_unused: true, original_packaging: true }, newSession()).eligible, true);
    assert.equal(checkReturnEligibility("ORD-102", { is_opened: true }, newSession()).eligible, false);
    orders[1].delivered_days_ago = 2;
    assert.equal(checkReturnEligibility("ORD-102", { is_damaged: true }, newSession()).needs_information, true);
    assert.equal(checkReturnEligibility("ORD-102", { is_damaged: true, photos_available: true }, newSession()).eligible, true);
    orders[1].delivered_days_ago = 3;
    assert.equal(checkReturnEligibility("ORD-102", { is_damaged: true, photos_available: true }, newSession()).eligible, false);
  } finally { orders[1].delivered_days_ago = original; }
});
test("call state is signed, tampering and expiration are rejected", () => {
  const data = newSession(); data.cancelled.push("ORD-103");
  assert.deepEqual(readSession(signSession(data)), data);
  const token = signSession(data); assert.throws(() => readSession(`${token.split(".")[0]}a.${token.split(".")[1]}`));
  assert.throws(() => readSession(signSession({ ...data, expires: 0 })));
});
test("missing order cancellation carries intent into spoken ID followup", () => {
  const session = newSession();
  assert.match(demoReply("Cancel my order", session), /order ID/);
  assert.match(demoReply("one zero three", session), /cancelled/);
  assert.equal(summarize(session).resolution_status, "RESOLVED");
});
test("tracking, invalid orders, return refusal, scope and shipping ambiguity", () => {
  const session = newSession();
  assert.match(demoReply("Where is ORD-101?", session), /6 PM/);
  assert.match(demoReply("Can I return ORD-102?", session), /14 days/);
  assert.match(demoReply("Where is ORD-999?", session), /verify/);
  assert.match(demoReply("Book me a flight", session), /Aura/);
  assert.match(demoReply("What is shipping at 499?", session), /doesn't specify/);
});
test("explicit refusal to cancel is not cancellation intent", () => {
  assert.equal(detectIntent("Don't cancel ORD-103"), "UNKNOWN");
  const session = newSession(); demoReply("Don't cancel ORD-103", session);
  assert.deepEqual(session.cancelled, []);
  demoReply("Cancel my order", session); demoReply("Don't cancel ORD-103", session);
  assert.deepEqual(session.cancelled, []);
});
test("empty summary and multiple intents accurately retain outcomes", () => {
  assert.equal(summarize(newSession()).resolution_status, "NO_CONVERSATION");
  const session = newSession(); demoReply("Where is ORD-101?", session); demoReply("Return ORD-102", session);
  assert.equal(summarize(session).customer_intent, "MULTIPLE_INTENTS");
  assert.equal(summarize(session).order_id, null);
  assert.match(summarize(session).call_summary, /14 days/);
});
