import type { ContextDecision, SearchMatch, SentenceAnalysis } from "@/lib/lexi/types";
import { ruleIntents } from "./intent-rules";

export function determineContext(
  analysis: SentenceAnalysis,
  matches: SearchMatch[],
): ContextDecision {
  const totals = new Map<
    string,
    { matchScore: number; matchWeight: number; ruleScore: number }
  >();

  matches.forEach((match, index) => {
    const rankWeight = 1 / (index + 1);
    const current = totals.get(match.entry.intent) ?? {
      matchScore: 0,
      matchWeight: 0,
      ruleScore: 0,
    };
    current.matchScore += match.score * rankWeight;
    current.matchWeight += rankWeight;
    totals.set(match.entry.intent, current);
  });

  for (const [intent, score] of ruleIntents(analysis)) {
    const current = totals.get(intent) ?? {
      matchScore: 0,
      matchWeight: 0,
      ruleScore: 0,
    };
    current.ruleScore = Math.max(current.ruleScore, score);
    totals.set(intent, current);
  }

  const ranked = [...totals.entries()]
    .map(([intent, total]) => {
      const evidenceScore = total.matchWeight > 0
        ? total.matchScore / total.matchWeight
        : 0;
      const agreementBonus = total.ruleScore > 0 && evidenceScore > 0 ? 0.05 : 0;
      const confidence = Math.min(
        0.99,
        total.ruleScore * 0.72 + evidenceScore * 0.28 + agreementBonus,
      );
      return { intent, confidence };
    })
    .sort((left, right) => {
      if (right.confidence !== left.confidence) return right.confidence - left.confidence;
      return left.intent.localeCompare(right.intent);
    });
  const result = ranked[0] ?? { intent: "unknown", confidence: 0 };
  const intent = result.confidence >= 0.38 ? result.intent : "unknown";
  const supporting = matches.filter((match) => match.entry.intent === intent);
  const evidence = [...new Set(supporting.flatMap((match) => match.matchedTerms))].slice(0, 8);

  return {
    intent,
    confidence: result.confidence,
    evidence,
    topMatches: matches,
  };
}
