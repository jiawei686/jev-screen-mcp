# jev-screen-mcp

> Content-moderation gate as a **single-purpose** MCP tool, powered by **Jev** (TypeSafe's System One decision model). One MCP, one job.

Real-world cost on OpenRouter — **4.9M tokens · $0.19 over 7 days**:

<img src="assets/usage-spend.png" alt="Jev cost on OpenRouter" width="100%"/>

Turns text into a **typed decision** — no prose, no Jev API knowledge needed from the host agent.

## What it does

`screen_content(text, categories?)` returns a structured verdict instead of free-form text:

| Field | Type | Meaning |
|-------|------|---------|
| `spam_prob` | number (0–1) | P(spam / unsolicited promotion) |
| `toxic_prob` | number (0–1) | P(toxic / abusive / harmful) |
| `category` | string | Best-fit label from the category list |
| `severity_score` | number (0–3) | Index into the severity scale |
| `severity_label` | `benign` \| `mild` \| `moderate` \| `severe` | Human-readable severity |
| `confidence` | number (0–1) | Model's calibrated certainty on the verdict |
| `violates_policy` | boolean | `spam_prob > 0.5` or `toxic_prob > 0.5` |
| `action` | `allow` \| `review` \| `block` | What the agent should do next |

**Decision gate:**

- `confidence < 0.5` → `review`
- else if `violates_policy` → `block` when `severity_score >= 2.5` (severe), otherwise `review`
- else → `allow`

> ⚠️ Only auto-act on `allow` / `block` when `confidence` is high. A high
> `spam_prob` alone is never permission to `block` — gate on `confidence`.

Default category taxonomy (7 labels): `spam_promo`, `harassment`, `hate`,
`self_harm`, `sexual`, `violence`, `benign`. Pass `categories` to override.

## Install & build

```bash
npm install
npm run build
```

The compiled server is at `dist/index.js`.

## Add to your MCP client

```json
{
  "mcpServers": {
    "jev-screen": {
      "command": "node",
      "args": ["/absolute/path/jev-screen-mcp/dist/index.js"],
      "env": { "TYPESAFE_API_KEY": "ts_xxx" }
    }
  }
}
```

No key? It still runs in **mock mode** (`JEV_MCP_MOCK=1`, or simply no `TYPESAFE_API_KEY`) so you can try it offline.

## Example call

```json
{
  "text": "BUY NOW!! limited offer, click here for free crypto prize, act now!!!"
}
```

returns something like:

```json
{
  "spam_prob": 0.9,
  "toxic_prob": 0.1,
  "category": "spam_promo",
  "severity_score": 3,
  "severity_label": "severe",
  "confidence": 0.7,
  "violates_policy": true,
  "action": "block"
}
```

## Model endpoint

Works with any Jev-compatible endpoint. Default is the TypeSafe API
(`https://api.typesafe.ai/v1/systemone`); override with `JEV_BASE_URL`
(e.g. an OpenRouter-compatible route) and set `TYPESAFE_API_KEY` to your
provider key.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TYPESAFE_API_KEY` | — | TypeSafe Jev key. Absent ⇒ mock mode |
| `JEV_MCP_MOCK` | `0` | Set `1` to force the deterministic offline mock |
| `JEV_MODEL` | `jev-latest` | Model id sent to the endpoint |
| `JEV_BASE_URL` | `https://api.typesafe.ai/v1/systemone` | API base URL |
| `JEV_MCP_TIMEOUT_MS` | `30000` | Per-call timeout (ms) |

## Mock mode

With no key (or `JEV_MCP_MOCK=1`) the server answers **deterministically** from
keyword heuristics — useful for demos, tests, and offline development. A single
derived risk signal drives every field, so the mock stays internally consistent
(spammy text → high `spam_prob`, severe, `block`).

## Diagnostics

```bash
node dist/index.js doctor          # human-readable
node dist/index.js doctor --json   # machine-readable
```

Prints mock/live mode, key presence, model, and base URL.

## Test

```bash
npm test
```

Runs a smoke test against the compiled output in deterministic mock mode.

## Notes

- Jev is a **decision** model: pure text in → typed decision out. It does not read
  images or generate prose.
- Keep text within Jev's ~64k-token total budget.
- Keep the human in the loop: route anything that is not a high-confidence
  `allow` / `block` to a person.

## License

MIT
