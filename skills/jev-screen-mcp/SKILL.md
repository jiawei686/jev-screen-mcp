---
name: jev-screen-mcp
description: Single-purpose MCP server that wraps Jev (TypeSafe System One decision model) as a content-moderation gate. Use when an agent needs a typed allow/review/block decision for text (spam + toxicity + category + severity) — without writing Jev API calls. Trigger on "moderate this text", "is this spam", "content safety check", "classify this message", "block policy violations".
---

# jev-screen-mcp

One MCP, one function: a **content-moderation & classification gate** powered by
Jev.

## What it gives you
- Tool `screen_content(text, categories?)` → `{ spam_prob, toxic_prob, category, severity_score, severity_label, confidence, violates_policy, action }`.
- `action` is `allow` (clearly benign), `review` (low confidence or ambiguous), or `block` (high confidence + severe violation, severity score ≥ 2.5).
- The agent should only auto-act on `block`/`allow` when `confidence` is high; `review` ⇒ route to a human.

## Why single-purpose
This server is intentionally NOT a multi-tool toolbox. One MCP = one function, so
it is trivial to compose, audit, and swap. The companion server `jev-review-mcp`
handles code review; each is independent.

## Setup for the host agent
```json
{ "mcpServers": { "jev-screen": {
  "command": "node",
  "args": ["/abs/path/jev-screen-mcp/dist/index.js"],
  "env": { "TYPESAFE_API_KEY": "ts_xxx" }
}}}
```
- No key ⇒ deterministic **mock** mode (no network). Force with `JEV_MCP_MOCK=1`.
- `categories` lets you override the default 7-label taxonomy with your own.
- `node dist/index.js doctor` prints auth/mode diagnostics.

## Notes
- Jev is a *decision* model: pure text in, typed decision out. It does not read
  images or generate prose.
- `confidence` is the model's reported calibration, not truth. Never treat a
  high `spam_prob` as permission to `block` on its own — gate on `confidence`.
- Keep text within Jev's ~64k token total budget.
