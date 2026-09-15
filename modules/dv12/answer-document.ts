import { normalize, type Store } from './store';
import { valueText } from './executor';
import type { Result } from './types';

const qualification = /^(?:within|among|i could|the recorded sources|request canceled|which meaning|i do not|i cannot)/i;

export function buildVerifiedClaims(result: Result, store: Store) {
  const sentences = result.text.split(/(?<=[.!?])(?:\s+|$)|\n+/).map((text) => text.trim()).filter(Boolean);
  const queryPlan = result.selectedPlan.kind === 'query' ? result.selectedPlan : undefined;
  return sentences.map((text) => {
    const normalized = normalize(text);
    const answerOnSubject = !!queryPlan && queryPlan.atoms.some((atom) => atom.subject.kind === 'variable' && atom.subject.name === queryPlan.answer);
    const answerOnObject = !!queryPlan && queryPlan.atoms.some((atom) => atom.object.kind === 'variable' && atom.object.name === queryPlan.answer);
    let facts = result.facts.filter((fact) => {
      const subject = normalize(store.entity(fact.subject)?.name ?? fact.subject);
      const object = normalize(valueText(fact.object, store));
      const scopedAbility = fact.relation === 'ability' && normalized.includes(subject) && !!fact.scope && normalized.includes(normalize(fact.scope));
      return scopedAbility || normalized.includes(subject) && normalized.includes(object) || answerOnSubject && normalized.includes(subject) || answerOnObject && normalized.includes(object);
    });
    if (!facts.length && sentences.length === 1) facts = result.facts;
    const factIds = [...new Set(facts.map((fact) => fact.id))];
    const proofIds = [...new Set(result.proof.filter((proof) => proof.premises.some((id) => factIds.includes(id)) || proof.premises.some((id) => facts.some((fact) => fact.premises?.includes(id)))).map((proof) => proof.id))];
    const booleanVerdict = result.selectedPlan.kind === 'query' && result.selectedPlan.shape === 'boolean' && /^(?:yes|no)\.$/i.test(text) && result.proof.length > 0;
    const qualifying = qualification.test(text);
    return {
      text,
      factIds,
      proofIds,
      verified: factIds.length > 0 || booleanVerdict || qualifying || result.selectedPlan.kind === 'calculate' || result.selectedPlan.kind === 'convert' || result.selectedPlan.kind === 'inventory' && result.proof.length > 0 || result.selectedPlan.kind === 'logic' || result.selectedPlan.kind === 'memory' || result.selectedPlan.kind === 'social' || result.selectedPlan.kind === 'followup',
      answerRole: booleanVerdict ? 'verdict' as const : qualifying ? 'qualification' as const : result.selectedPlan.kind === 'followup' && result.selectedPlan.action === 'proof' ? 'provenance' as const : result.selectedPlan.kind === 'query' && result.selectedPlan.shape === 'procedure' ? 'procedure-step' as const : 'value' as const,
      subjectIds: [...new Set(facts.map((fact) => fact.subject))],
      relations: [...new Set(facts.map((fact) => fact.relation))],
      polarity: facts.some((fact) => fact.negative) ? facts.every((fact) => fact.negative) ? 'negative' as const : 'mixed' as const : 'positive' as const,
      qualifiers: [...new Set(facts.flatMap((fact) => [fact.scope, fact.from && `from ${fact.from}`, fact.to && `through ${fact.to}`, fact.condition && `condition: ${fact.condition}`].filter((value): value is string => !!value)))],
      sourceLimitations: [...new Set(facts.flatMap((fact) => [fact.source.review !== 'reviewed' ? fact.source.review : '', fact.source.disputed ? 'disputed' : ''].filter(Boolean)))],
    };
  });
}
