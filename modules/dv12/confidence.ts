import type { Result } from './types';

export type ConfidenceFeatures = {
  parseCoverage: number;
  parseCandidateMargin: number;
  semanticTypeCompatibility: number;
  unresolvedModifierPenalty: number;
  entityCandidateMargin: number;
  lexicalSenseMargin: number;
  retrievalCompleteness: number;
  joinCompletion: number;
  evidenceReviewQuality: number;
  sourceFreshness: number;
  conflictFreedom: number;
  proofDepthStrength: number;
  ruleReliability: number;
  resultSetCompleteness: number;
  realizationVerification: number;
  measuredGrammarFamily: number;
};

const reviewQuality = { reviewed: 1, 'source-attested': .85, derived: .75, seed: .7, user: .65 } as const;
export function confidenceFeatures(result: Result, parseCoverage: number, candidateMargin: number): ConfidenceFeatures {
  const mentions = result.selectedPlan.kind === 'query' ? result.selectedPlan.atoms.flatMap((atom) => [atom.subject, atom.object]).filter((term) => term.kind === 'mention') : [];
  const evidence = result.facts.length ? Math.min(...result.facts.map((fact) => reviewQuality[fact.source.review])) : result.proof.length ? 1 : 0;
  const deepest = result.proof.reduce((max, proof) => Math.max(max, proof.premises.length), 0);
  const verified = result.claims.length ? Number(result.claims.every((claim) => claim.verified)) : Number(!result.text || result.selectedPlan.kind === 'unknown');
  return {
    parseCoverage,
    parseCandidateMargin: Math.max(0, Math.min(1, candidateMargin)),
    semanticTypeCompatibility: mentions.length ? 0 : 1,
    unresolvedModifierPenalty: result.code === 'UNCONSUMED_MEANINGFUL_TOKENS' ? 1 : 0,
    entityCandidateMargin: mentions.length ? 0 : 1,
    lexicalSenseMargin: result.status === 'ambiguous' ? 0 : 1,
    retrievalCompleteness: result.coverage ? Number(result.coverage.complete) : result.code === 'RETRIEVAL_TRUNCATED' ? 0 : 1,
    joinCompletion: result.selectedPlan.kind === 'query' ? Number(result.selectedPlan.atoms.every((atom) => atom.subject.kind !== 'mention' && atom.object.kind !== 'mention')) : 1,
    evidenceReviewQuality: evidence,
    sourceFreshness: result.facts.some((fact) => fact.from || fact.to || fact.source.snapshot) ? 1 : .5,
    conflictFreedom: Number(result.status !== 'conflict' && !result.facts.some((fact) => fact.source.disputed)),
    proofDepthStrength: deepest > 8 ? 0 : deepest > 4 ? .6 : 1,
    ruleReliability: result.proof.some((proof) => proof.rule === 'derived') ? .75 : 1,
    resultSetCompleteness: result.coverage ? Number(result.coverage.complete) : ['supported', 'contradicted'].includes(result.status) ? 1 : 0,
    realizationVerification: verified,
    measuredGrammarFamily: 0,
  };
}
