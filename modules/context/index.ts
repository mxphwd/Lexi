import type { ContextDecision, SearchMatch, SentenceAnalysis } from "@/lib/lexi/types";
import { ruleIntents } from "./intent-rules";

export function determineContext(
  analysis: SentenceAnalysis,
  matches: SearchMatch[],
): ContextDecision {
  const totals = new Map<string, { score: number; count: number }>();

  matches.forEach((match, index) => {
    const rankWeight = 1 / (index + 1);
    const current = totals.get(match.entry.intent) ?? { score: 0, count: 0 };
    current.score += match.score * rankWeight;
    current.count += 1;
    totals.set(match.entry.intent, current);
  });

  for (const [intent, score] of ruleIntents(analysis)) {
    const current = totals.get(intent) ?? { score: 0, count: 0 };
    current.score += score;
    current.count += 1;
    totals.set(intent, current);
  }

  const ranked = [...totals.entries()].sort((left, right) => {
    if (right[1].score !== left[1].score) return right[1].score - left[1].score;
    return left[0].localeCompare(right[0]);
  });
  const [intent = "unknown", result = { score: 0, count: 0 }] = ranked[0] ?? [];
  const confidence = Math.min(0.99, result.score / Math.max(1, result.count * 0.74));
  const supporting = matches.filter((match) => match.entry.intent === intent);
  const evidence = [...new Set(supporting.flatMap((match) => match.matchedTerms))].slice(0, 8);

  return {
    intent: confidence >= 0.38 ? intent : "unknown",
    confidence,
    evidence,
    topMatches: matches,
  };
}
