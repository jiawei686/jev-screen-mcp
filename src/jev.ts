// Thin client for TypeSafe Jev (System One decision model).
// Supports live API calls and a deterministic MOCK mode so the server runs
// with zero configuration (no API key).

export type JevNoul = number; // 0..1

export interface JevChoice {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface JevScore {
  score: number; // expected value over the ordinal scale (see README caveats)
  probabilities: Record<string, number>;
  confidence: number;
}

export type JevAnswer = JevNoul | JevChoice | JevScore;

export interface JevQuestion {
  type: "noul" | "choice" | "score";
  instructions: string;
  options?: string[]; // choice
  criteria?: string[]; // score (ordered low -> high)
}

const DEFAULT_BASE_URL = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-latest";

/**
 * Call Jev with a state + a map of typed questions, and return normalized
 * answers. With JEV_MCP_MOCK=1 OR no TYPESAFE_API_KEY it returns deterministic
 * mock answers (no network).
 */
export async function decide(
  state: string,
  questions: Record<string, JevQuestion>,
  opts: {
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    timeoutMs?: number;
  } = {}
): Promise<Record<string, JevAnswer>> {
  const hasKey = Boolean(opts.apiKey ?? process.env.TYPESAFE_API_KEY);
  if (process.env.JEV_MCP_MOCK === "1" || !hasKey) {
    return mockJev(state, questions);
  }

  const base = opts.baseUrl ?? process.env.JEV_BASE_URL ?? DEFAULT_BASE_URL;
  const model = opts.model ?? process.env.JEV_MODEL ?? DEFAULT_MODEL;
  const timeout = opts.timeoutMs ?? Number(process.env.JEV_MCP_TIMEOUT_MS ?? 30000);

  const body = { model, state, questions };
  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey ?? process.env.TYPESAFE_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jev API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return normalize(data);
}

/** Tolerant parser: Jev's response shape may nest answers under results/answers. */
function normalize(data: unknown): Record<string, JevAnswer> {
  const container: Record<string, unknown> =
    (data as any)?.results ?? (data as any)?.answers ?? (data as any);
  if (!container || typeof container !== "object") {
    throw new Error("Jev response missing an answers map");
  }
  const out: Record<string, JevAnswer> = {};
  for (const [k, raw] of Object.entries(container)) {
    out[k] = extractAnswer(raw);
  }
  return out;
}

function extractAnswer(raw: unknown): JevAnswer {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if ("noul" in o && typeof o.noul === "number") return o.noul as number;
    const hasProbs = o.probabilities && typeof o.probabilities === "object";
    if ("choice" in o || (hasProbs && !("score" in o))) {
      const probabilities = (o.probabilities as Record<string, number>) ?? {};
      let choice = o.choice as string | undefined;
      if (!choice && Object.keys(probabilities).length) {
        choice = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
      }
      return {
        choice: choice ?? "",
        probabilities,
        confidence: typeof o.confidence === "number" ? o.confidence : 0.5,
      };
    }
    if ("score" in o || (hasProbs && numericKeys(o.probabilities))) {
      return {
        score: typeof o.score === "number" ? o.score : 0,
        probabilities: (o.probabilities as Record<string, number>) ?? {},
        confidence: typeof o.confidence === "number" ? o.confidence : 0.5,
      };
    }
  }
  throw new Error("Unrecognized Jev answer shape");
}

function numericKeys(p: unknown): boolean {
  if (!p || typeof p !== "object") return false;
  return Object.keys(p as Record<string, unknown>).every((k) => /^\d+$/.test(k));
}

/** Deterministic, key-free mock so the server is testable/demoable offline.
 *  A single derived risk signal drives every answer, so the mock stays
 *  internally consistent (spammy input -> high spam, high severity, etc.). */
function mockJev(
  state: string,
  questions: Record<string, JevQuestion>
): Record<string, JevAnswer> {
  const s = state.toLowerCase();
  const any = (...words: string[]) => words.some((w) => s.includes(w));

  const spammy = any(
    "buy", "cheap", "viagra", "free", "click here", "discount", "offer",
    "casino", "crypto", "prize", "urgent", "limited", "act now", "money back"
  );
  const abusive = any("idiot", "stupid", "hate you", "kill", "loser", "scum", "trash");
  const codeRisk = any(
    "password", "secret", "api_key", "eval(", "exec(", "delete from",
    "drop table", "select *", "-- ", "rm -rf", "<script"
  );

  const spamScore = clamp01(spammy ? 0.9 : any("http://", "https://", "@") ? 0.4 : 0.1);
  const toxicScore = clamp01(abusive ? 0.85 : 0.1);
  const safeScore = clamp01(codeRisk ? 0.2 : 0.92);
  const risk = Math.max(spamScore, toxicScore, 1 - safeScore); // 0..1

  const out: Record<string, JevAnswer> = {};
  for (const [name, q] of Object.entries(questions)) {
    if (q.type === "noul") {
      const instr = q.instructions.toLowerCase();
      let v: number;
      if (instr.includes("spam") || instr.includes("advertis") || instr.includes("promotion")) v = spamScore;
      else if (instr.includes("toxic") || instr.includes("abuse") || instr.includes("harmful")) v = toxicScore;
      else if (instr.includes("safe")) v = safeScore;
      else v = clamp01(0.9 - 0.5 * risk);
      out[name] = round3(v);
    } else if (q.type === "score") {
      const criteria = q.criteria ?? ["low", "high"];
      const idx = Math.min(criteria.length - 1, Math.round(risk * (criteria.length - 1)));
      out[name] = { score: idx, probabilities: dist(criteria.length, idx), confidence: 0.7 };
    } else {
      const options = q.options ?? [];
      let hit = "";
      if (spammy && options.includes("spam_promo")) hit = "spam_promo";
      else if (abusive && (options.includes("harassment") || options.includes("hate")))
        hit = options.includes("harassment") ? "harassment" : "hate";
      else if (codeRisk && options.includes("request_changes")) hit = "request_changes";
      else if (!spammy && !abusive && !codeRisk)
        hit = options.includes("benign") ? "benign" : options.includes("approve") ? "approve" : (options[0] ?? "");
      else hit = options[0] ?? "";
      out[name] = {
        choice: hit,
        probabilities: dist(options.length, Math.max(0, options.indexOf(hit))),
        confidence: 0.7,
      };
    }
  }
  return out;
}

function clamp01(n: number): number {
  return Math.max(0.01, Math.min(0.99, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function dist(n: number, peak: number): Record<string, number> {
  const p: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    p[String(i)] = i === peak ? 0.8 : 0.2 / Math.max(1, n - 1);
  }
  return p;
}

export function isMockActive(): boolean {
  const hasKey = Boolean(process.env.TYPESAFE_API_KEY);
  return process.env.JEV_MCP_MOCK === "1" || !hasKey;
}
