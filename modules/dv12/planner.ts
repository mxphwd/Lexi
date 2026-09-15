import { entity, variable, type Alternative, type Plan, type Select, type Term } from './types';
import type { SemanticClause, Span } from './semantic-ir';

export type MentionResolver = (text: string, role: 'subject' | 'object') => Term;

function query(subject: Term, relation: string, shape: Select['shape'] = 'value', object: Term = variable('answer')): Select {
  return { kind: 'query', atoms: [{ subject, relation, object }], filters: [], answer: 'answer', shape };
}

function resolveSpan(resolve: MentionResolver, value: Span, role: 'subject' | 'object') {
  return resolve(value.text.replace(/^(?:the|an?)\s+/i, '').trim(), role);
}

export function compileSemantic(ir: SemanticClause, resolve: MentionResolver): Alternative | undefined {
  const intent = ir.intent;
  if (!intent) return undefined;
  let plan: Plan;
  if (intent.kind === 'unsupported') {
    plan = { kind: 'unknown', reason: intent.reason, category: intent.family };
  } else if (intent.kind === 'compare') {
    if (!intent.metric) {
      plan = { kind: 'unknown', reason: 'Which measurable property should I compare?', slot: 'comparison property', category: 'ambiguous-operation' };
    } else {
      plan = {
        kind: 'compare',
        subjects: intent.subjects.map((subject) => resolveSpan(resolve, subject, 'subject')),
        relation: intent.metric,
        mode: intent.mode,
        preference: intent.preference,
      };
    }
  } else if (intent.kind === 'join') {
    const seed = resolveSpan(resolve, intent.seed, 'subject');
    plan = {
      kind: 'query',
      atoms: intent.atoms.map((atom) => ({
        subject: atom.subject === 'seed' ? seed : variable(atom.subject),
        relation: atom.relation,
        object: variable(atom.object),
      })),
      filters: [],
      answer: intent.answer,
      shape: 'value',
    };
  } else if (intent.kind === 'verify') {
    plan = {
      kind: 'query',
      atoms: intent.propositions.map((proposition) => ({
        subject: resolveSpan(resolve, proposition.subject, 'subject'),
        relation: proposition.relation,
        object: resolveSpan(resolve, proposition.object, 'object'),
        negative: proposition.negative || undefined,
      })),
      filters: [],
      answer: 'verdict',
      shape: 'boolean',
    };
  } else if (intent.kind === 'quantify') {
    const restriction = resolveSpan(resolve, intent.restriction, 'object');
    const object = intent.relation === 'ability' ? { kind: 'boolean' as const, value: true } : resolveSpan(resolve, intent.object, 'object');
    plan = {
      kind: 'query',
      atoms: [
        { subject: variable('member'), relation: 'is_a', object: restriction },
        { subject: variable('member'), relation: intent.relation, object, scope: intent.scope },
      ],
      filters: [],
      answer: 'verdict',
      shape: 'boolean',
      quantifier: { kind: intent.quantifier.kind, count: intent.quantifier.count },
    };
  } else {
    const relations = intent.relations;
    if (relations.length !== 1) return undefined;
    const relation = relations[0].id;
    if (intent.answerSide === 'subject') {
      if (!intent.object) return undefined;
      plan = query(variable('answer'), relation, intent.shape === 'value' ? 'list' : intent.shape, resolveSpan(resolve, intent.object, 'object'));
    } else if (intent.subjects.length === 1) {
      plan = query(resolveSpan(resolve, intent.subjects[0], 'subject'), relation, intent.shape);
      if (intent.object) plan.atoms[0].object = resolveSpan(resolve, intent.object, 'object');
      if (intent.polarity === 'negative') plan.atoms[0].negative = true;
    } else {
      const subjects = intent.subjects.map((subject) => resolveSpan(resolve, subject, 'subject'));
      plan = query(variable('subject'), relation, 'list');
      plan.filters.push({ left: variable('subject'), op: 'member', right: { kind: 'list', ordered: true, values: subjects.filter((term): term is ReturnType<typeof entity> => term.kind === 'entity') } });
      if (subjects.some((term) => term.kind !== 'entity')) {
        plan = { kind: 'unknown', reason: 'I could not resolve every coordinated subject.', slot: 'coordinated subjects', category: 'entity-linking' };
      } else plan.limit = subjects.length;
    }
  }
  return { plan, grammar: `compositional:${ir.construction ?? intent.kind}`, score: ir.meaningfulCoverage };
}
