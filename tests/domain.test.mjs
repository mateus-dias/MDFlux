import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { total, access, summarize, csvCell, plans } from "../src/domain.mjs";
import { verifyWebhook } from "../netlify/lib/core.mjs";
test("document totals and discounts", () => {
  assert.equal(total([{ qty: 3, price: 19.9 }], 9.7), 50);
  assert.equal(total([{ qty: 0.1, price: 0.2 }]), 0.02);
});
test("72-hour cutoff, suspended, paid and canceled access", () => {
  const end = Date.parse("2026-11-02T13:00:00Z");
  const s = { status: "trialing", trial_end: new Date(end).toISOString() };
  assert.equal(access(s, end - 1), true);
  assert.equal(access(s, end), false);
  assert.equal(access({ ...s, suspended: true }, end - 1), false);
  assert.equal(
    access({ status: "payment_pending", paid_until: "2099-01-01" }, end),
    false,
  );
  assert.equal(
    access({ status: "canceled", paid_until: "2099-01-01" }, end),
    true,
  );
});
test("cash and forecasts remain separate", () => {
  const s = summarize([
    { kind: "income", amount: 1000, paid: 200 },
    { kind: "expense", amount: 500, paid: 100 },
  ]);
  assert.deepEqual(
    [s.cash, s.receivable, s.payable, s.estimated],
    [100, 800, 400, 500],
  );
});
test("CSV neutralizes spreadsheet formulas and escapes quotes", () => {
  assert.equal(csvCell("=cmd()"), '"\'=cmd()"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
test("plans use requested price and user limits", () => {
  assert.deepEqual(
    Object.values(plans).map((p) => [p.price, p.users]),
    [
      [69.9, 1],
      [99.9, 3],
      [129.9, 10],
    ],
  );
});
test("webhook validates signature, request, resource and timestamp", () => {
  const now = Date.now(),
    ts = String(Math.floor(now / 1000)),
    secret = "test-secret",
    sig = createHmac("sha256", secret)
      .update(`id:abc;request-id:req;ts:${ts};`)
      .digest("hex");
  const req = new Request("https://example.test", {
    headers: { "x-signature": `ts=${ts},v1=${sig}`, "x-request-id": "req" },
  });
  assert.equal(verifyWebhook(req, "ABC", secret, now), true);
  assert.equal(verifyWebhook(req, "other", secret, now), false);
  assert.equal(verifyWebhook(req, "ABC", "wrong", now), false);
  assert.equal(verifyWebhook(req, "ABC", secret, now + 600000), false);
  assert.equal(
    verifyWebhook(new Request("https://example.test"), "abc", secret, now),
    false,
  );
});
