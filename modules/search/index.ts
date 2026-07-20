import type { ContextEntry, SearchMatch, SentenceAnalysis } from "@/lib/lexi/types";
import { diceCoefficient, jaccard } from "./similarity";
import { analyseSentence, contentTokens, tokenize } from "./tokenize";
import { expandTerms } from "./thesaurus";

function scoreEntry(analysis: SentenceAnalysis, entry: ContextEntry): SearchMatch {
  const entryTokens = contentTokens(tokenize(entry.input));
  const queryTerms = new Set(analysis.contentTokens);
  const expandedTerms = expandTerms(analysis.contentTokens);
  const expandedSet = new Set(expandedTerms);
  const entryTerms = new Set([...entryTokens, ...entry.keywords]);

  const directOverlap = jaccard(queryTerms, entryTerms);
  const expandedOverlap = jaccard(expandedSet, entryTerms);
  const lexicalScore = directOverlap * 0.7 + expandedOverlap * 0.3;
  const phraseScore = diceCoefficient(analysis.normalized, entry.input.toLowerCase());
  const structureScore = analysis.mode === entry.mode ? 1 : 0.35;
  const matchedTerms = [...entryTerms].filter(
    (term) => queryTerms.has(term) || expandedSet.has(term),
  );
  const score = lexicalScore * 0.58 + phraseScore * 0.32 + structureScore * 0.1;

  return {
    entry,
    score,
    lexicalScore,
    phraseScore,
    structureScore,
    matchedTerms,
    expandedTerms: expandedTerms.filter((term) => !queryTerms.has(term)),
  };
}

export function searchContexts(
  input: string,
  entries: ContextEntry[],
  limit = 5,
): { analysis: SentenceAnalysis; matches: SearchMatch[] } {
  const analysis = analyseSentence(input);
  const matches = entries
    .map((entry) => scoreEntry(analysis, entry))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.entry.id.localeCompare(right.entry.id);
    })
    .slice(0, limit);

  return { analysis, matches };
}

export { analyseSentence, hasUnsupportedWritingSystem } from "./tokenize";
