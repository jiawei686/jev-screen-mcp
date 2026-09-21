// Smoke test: exercises screen_content in deterministic MOCK mode.
// Runs against the compiled output (run `npm run build` first).
import { test } from "node:test";
import assert from "node:assert/strict";
import { screenContent } from "../dist/tools/screen_content.js";

process.env.JEV_MCP_MOCK = "1";

test("screen_content returns moderation decision", async () => {
  const r = await screenContent("buy cheap meds now, limited offer!!");
  assert.ok(r.spam_prob >= 0 && r.spam_prob <= 1);
  assert.ok(["allow", "review", "block"].includes(r.action));
  assert.equal(typeof r.category, "string");
});

test("screen_content accepts custom categories", async () => {
  const r = await screenContent("hello there", ["greeting", "benign", "spam"]);
  assert.ok(["greeting", "benign", "spam"].includes(r.category));
});
