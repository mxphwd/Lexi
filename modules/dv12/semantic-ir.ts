import type { MorphToken } from './morphology';

export type Span = { start: number; end: number; text: string };
export type GrammaticalRole = 'subject' | 'direct-object' | 'indirect-object' | 'complement' | 'agent' | 'patient' | 'possessor' | 'location' | 'time' | 'instrument' | 'cause' | 'purpose';
export type Phrase = Span & { kind: 'noun' | 'verb' | 'property' | 'preposition' | 'quantity' | 'reference'; head: string; role?: GrammaticalRole };
export type Coordination = { kind: 'subjects' | 'objects' | 'predicates' | 'clauses' | 'alternative' | 'contrast' | 'sequence'; members: Span[]; conjunction: string };
export type TemporalExpression = { kind: 'closed' | 'before' | 'after' | 'point' | 'relative' | 'century'; from?: string; to?: string; span: Span };
export type QuantifierExpression = { kind: 'all' | 'any' | 'none' | 'most' | 'exact' | 'minimum' | 'maximum'; count?: number; span: Span };
export type SemanticRole = { role: GrammaticalRole | 'answer'; span: Span };
export type SemanticPredicate = {
  surface: Span;
  relationCandidates: string[];
  voice: 'active' | 'passive' | 'possessive' | 'relational-noun' | 'copular';
  polarity: 'positive' | 'negative';
  roles: SemanticRole[];
};
export type SemanticClause = {
  version: 1;
  original: string;
  tokens: MorphToken[];
  phrases: Phrase[];
  predicate?: SemanticPredicate;
  coordination: Coordination[];
  temporal: TemporalExpression[];
  quantifier?: QuantifierExpression;
  answerKind?: 'entity' | 'value' | 'boolean' | 'list' | 'explanation' | 'procedure';
  meaningfulCoverage: number;
  unconsumed: Span[];
  construction?: string;
  intent?: SemanticIntent;
};

export type SemanticIntent =
  | { kind: 'lookup'; subjects: Span[]; relations: Array<{ id: string; span: Span }>; object?: Span; answerSide: 'subject' | 'object'; shape: 'value' | 'list' | 'explanation' | 'procedure'; polarity: 'positive' | 'negative' }
  | { kind: 'verify'; propositions: Array<{ subject: Span; relation: string; object: Span; negative: boolean }> }
  | { kind: 'quantify'; restriction: Span; relation: string; object: Span; quantifier: QuantifierExpression; scope?: string }
  | { kind: 'compare'; subjects: Span[]; metric?: string; mode: 'qualitative' | 'difference' | 'ratio' | 'percentage' | 'attributes'; preference: 'greater' | 'lesser' }
  | { kind: 'join'; seed: Span; atoms: Array<{ subject: string; relation: string; object: string }>; answer: string }
  | { kind: 'unsupported'; family: string; reason: string };

export const span = (text: string, start: number, end: number): Span => ({ text: text.slice(start, end), start, end });
