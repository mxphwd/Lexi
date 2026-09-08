/** Evaluation tooling only. Never import this module into the response engine. */
import { createHash } from 'node:crypto';
import { grade as baseGrade, type Case, type Grade } from './dv12';
import type { Result } from '../dv12/types';

export type ReviewedCase = Case & { cohort: 'development' | 'held-out'; review: {
  reviewer: string; reviewedAt: string; consentConfirmed: boolean; privacyReviewed: boolean;
  expectedApproved: boolean; contextComplete: boolean; heldOutFromDevelopment: boolean;
  evidence: string;
}};
export type Adjudication = {
  caseId: string; responseHash: string; outcome: 'correct-answer' | 'incorrect-answer';
  reviewer: string; reviewedAt: string; rationale: string; humanReviewed: boolean;
};
export const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const questionKey = (c: Pick<Case,'prompt'|'turns'>) => fingerprint([...(c.turns ?? []),c.prompt].map(s=>s.normalize('NFKC').toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ').trim()));
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function validateReviewedCase(c: ReviewedCase) {
  if (!c || !nonempty(c.id) || !nonempty(c.prompt) || !nonempty(c.category) || typeof c.answerable !== 'boolean'
      || c.provenance?.kind !== 'real-failure' || !nonempty(c.provenance.author) || !Number.isFinite(Date.parse(c.provenance.capturedAt))
      || !['development','held-out'].includes(c.cohort)) throw new Error('INVALID_REVIEWED_CASE');
  if(c.prompt.length>12000 || c.turns && (!Array.isArray(c.turns)||c.turns.length>32||c.turns.some(t=>typeof t!=='string'||t.length>12000))) throw new Error('CASE_CONTEXT_BUDGET');
  const review = c.review;
  if (!review || !nonempty(review.reviewer) || !Number.isFinite(Date.parse(review.reviewedAt)) || !nonempty(review.evidence)
      || review.consentConfirmed !== true || review.privacyReviewed !== true || review.expectedApproved !== true || review.contextComplete !== true)
    throw new Error('HUMAN_REVIEW_REQUIRED');
  if (!c.expected || c.answerable && !c.expected.values?.length && !c.expected.text?.length && !c.expected.clarification?.length)
    throw new Error('EXPECTED_ANSWER_REQUIRED');
  const valueValid = (v: unknown, depth = 0): boolean => {
    if (!v || typeof v !== 'object' || depth > 8) return false;
    const value = v as Record<string, unknown>;
    if (value.kind === 'entity') return nonempty(value.id);
    if (value.kind === 'text') return nonempty(value.value);
    if (value.kind === 'boolean') return typeof value.value === 'boolean';
    if (value.kind === 'number') return typeof value.value === 'number' && Number.isFinite(value.value) && (value.unit === undefined || nonempty(value.unit));
    return value.kind === 'list' && typeof value.ordered === 'boolean' && Array.isArray(value.values) && value.values.length <= 100 && value.values.every(item=>valueValid(item,depth+1));
  };
  if (c.expected.values !== undefined && (!Array.isArray(c.expected.values) || c.expected.values.length > 100 || !c.expected.values.every(v=>valueValid(v)))) throw new Error('INVALID_EXPECTED_VALUES');
  for (const strings of [c.expected.text,c.expected.clarification]) if (strings !== undefined && (!Array.isArray(strings) || !strings.length || !strings.every(nonempty))) throw new Error('INVALID_EXPECTED_TEXT');
  if (c.expected.tolerance !== undefined && (!Number.isFinite(c.expected.tolerance) || c.expected.tolerance < 0)) throw new Error('INVALID_EXPECTED_TOLERANCE');
  if (c.cohort === 'held-out' && review.heldOutFromDevelopment !== true) throw new Error('HELD_OUT_ATTESTATION_REQUIRED');
  return c;
}

export function gradeDv13(c: Case, results: Result[]): Grade {
  // An explicitly incomplete search with no asserted answer is an abstention.
  if (results.length && results.every(r=>['unknown','insufficient'].includes(r.status) && !r.values.length))
    return {outcome:c.answerable?'unsupported-abstention':'correct-abstention',reason:'No answer asserted; answerability is defined by the case.',adjudication:false};
  return baseGrade(c,results);
}

export function adjudicate(initial: Grade, record: Adjudication | undefined, caseId: string, responseHash: string): Grade {
  if (!record || !initial.adjudication) return initial;
  if (record.caseId !== caseId || record.responseHash !== responseHash)
    return {...initial,reason:'Previous review is stale; the changed response needs human adjudication.'};
  if (record.humanReviewed !== true || !nonempty(record.reviewer) || !nonempty(record.rationale)
      || !Number.isFinite(Date.parse(record.reviewedAt)) || !['correct-answer','incorrect-answer'].includes(record.outcome))
    throw new Error('INVALID_HUMAN_ADJUDICATION');
  return {outcome:record.outcome,reason:`Human review by ${record.reviewer}: ${record.rationale}`,adjudication:false};
}

export function checkCohortSeparation(development: Case[], independent: Case[]) {
  const developmentKeys = new Set(development.map(questionKey));
  const seen = new Set<string>();
  for (const row of independent) {
    const key = questionKey(row);
    if (developmentKeys.has(key) || seen.has(key)) throw new Error('EVALUATION_COHORT_OVERLAP:'+row.id);
    seen.add(key);
  }
}
