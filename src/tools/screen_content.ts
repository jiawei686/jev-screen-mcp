import { decide, type JevChoice, type JevScore } from "../jev.js";

export interface ScreenContentResult {
  spam_prob: number;
  toxic_prob: number;
  category: string;
  severity_score: number;
  severity_label: string;
  confidence: number;
  violates_policy: boolean;
  action: "allow" | "review" | "block";
}

const DEFAULT_CATEGORIES = [
  "spam_promo",
  "harassment",
  "hate",
  "self_harm",
  "sexual",
  "violence",
  "benign",
];

const SEVERITY = ["benign", "mild", "moderate", "severe"];

/**
 * Content-moderation & classification gate. Given text, Jev returns spam and
 * toxicity probabilities, a category, and a severity. Low confidence routes to
 * `review`; clear, severe violations route to `block`.
 */
export async function screenContent(
  text: string,
  categories?: string[]
): Promise<ScreenContentResult> {
  const cats = categories && categories.length ? categories : DEFAULT_CATEGORIES;
  const questions = {
    spam: {
      type: "noul" as const,
      instructions: "Is this content spam, advertising, or unsolicited promotion?",
    },
    toxic: {
      type: "noul" as const,
      instructions:
        "Is this content toxic, abusive, or harmful to a person or group?",
    },
    category: {
      type: "choice" as const,
      instructions: "Which single category best describes this content?",
      options: cats,
    },
    severity: {
      type: "score" as const,
      instructions: "If it violates policy, how severe is the violation?",
      criteria: SEVERITY,
    },
  };

  const a = await decide(text, questions);
  const spam = a.spam as number;
  const toxic = a.toxic as number;
  const category = (a.category as JevChoice).choice;
  const sev = a.severity as JevScore;

  // Confidence comes from the model's own reported certainty on the choice and
  // score questions — NOT the probability magnitude. A clearly-benign input
  // (low spam/toxic prob) is still high-confidence; min'ing with the probabilities
  // would wrongly flag it as uncertain.
  const confidence = Math.min((a.category as JevChoice).confidence, sev.confidence);
  const violates = spam > 0.5 || toxic > 0.5;

  let action: ScreenContentResult["action"];
  if (confidence < 0.5) action = "review";
  else if (violates) action = sev.score >= 2.5 ? "block" : "review";
  else action = "allow";

  return {
    spam_prob: round(spam),
    toxic_prob: round(toxic),
    category,
    severity_score: round(sev.score),
    severity_label: SEVERITY[clampIdx(sev.score, SEVERITY.length)] ?? "unknown",
    confidence: round(confidence),
    violates_policy: violates,
    action,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clampIdx(score: number, len: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(len - 1, Math.round(score)));
}
