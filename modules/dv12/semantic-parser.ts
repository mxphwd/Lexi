import { numberWords } from './numbers';
import { analyzeSyntax, splitCoordination } from './syntax';
import { meaningful } from './tokenizer';
import type { Alternative, State, Term } from './types';
import type { Store } from './store';
import type { MorphToken } from './morphology';
import { span, type SemanticClause, type Span } from './semantic-ir';
import { compileSemantic } from './planner';
import { compatibleAnswerNoun } from '../dv13/language';

const properties: Record<string, string> = {
  capital: 'capital', definition: 'definition', meaning: 'definition', purpose: 'purpose', function: 'purpose',
  cause: 'cause', effect: 'effect', mechanism: 'mechanism', component: 'component', part: 'has_part',
  location: 'location', habitat: 'habitat', diet: 'diet', color: 'color', size: 'size', diameter: 'diameter',
  mass: 'mass', weight: 'mass', inventor: 'inventor', creator: 'creator', author: 'author', birthplace: 'birthplace',
  citizenship: 'citizenship', headquarters: 'headquarters', country: 'country', continent: 'continent', symbol: 'symbol',
  'atomic number': 'atomic_number', 'boiling point': 'boiling_point', 'melting point': 'melting_point',
  lifespan: 'lifespan', language: 'official_language', 'official language': 'official_language', requirement: 'requires', step: 'steps',
  'orbital period': 'orbit_period', 'rotation period': 'rotation_period',
};
const verbs: Record<string, string> = { invent: 'inventor', create: 'creator', paint: 'creator', write: 'author', discover: 'discoverer', own: 'owner' };
const demonyms: Record<string, string> = { french: 'France', german: 'Germany', italian: 'Italy', spanish: 'Spain', british: 'United Kingdom', american: 'United States', canadian: 'Canada', japanese: 'Japan', korean: 'South Korea', chinese: 'China', indian: 'India' };
const unsupported: Array<[string[], string]> = [
  [['write', 'poem'], 'creative-writing'], [['write', 'story'], 'creative-writing'], [['translate'], 'translation'],
  [['recommend'], 'recommendation'], [['summarize'], 'summarization'], [['grammar', 'correct'], 'grammar-review'],
  [['latest', 'news'], 'current-news'], [['plan', 'trip'], 'open-ended-planning'],
];

const words = (ir: SemanticClause) => meaningful(ir.tokens) as MorphToken[];
const lemmas = (ir: SemanticClause) => words(ir).map((token) => token.lemma);
const clean = (value: string) => value.replace(/^[,;:\s]+|[,;:.!?\s]+$/g, '').replace(/^(?:the|an?)\s+/i, '').trim();
function indices(haystack: readonly string[], needle: readonly string[]) {
  outer: for (let index = 0; index <= haystack.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) if (haystack[index + offset] !== needle[offset]) continue outer;
    return index;
  }
  return -1;
}
function range(input: string, tokens: readonly MorphToken[], start: number, end: number): Span {
  const selected = tokens.slice(Math.max(0, start), Math.max(start, end));
  if (!selected.length) return span(input, 0, 0);
  const first = selected.find((token) => token.kind !== 'punctuation') ?? selected[0];
  const last = [...selected].reverse().find((token) => token.kind !== 'punctuation') ?? selected.at(-1)!;
  const value = span(input, first.start, last.end); return { ...value, text: clean(value.text) };
}
function property(text: string, store: Store) {
  const normalized = clean(text).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
  const singular = normalized.endsWith('ies') ? `${normalized.slice(0, -3)}y` : normalized.endsWith('s') && !/(?:ss|us|is)$/.test(normalized) ? normalized.slice(0, -1) : normalized;
  if (properties[normalized] || properties[singular]) return properties[normalized] ?? properties[singular];
  const matches = store.allSchemas().filter((relation) => relation.id === singular.replaceAll(' ', '_') || relation.aliases.includes(normalized) || relation.aliases.includes(singular));
  return matches.length === 1 ? matches[0].id : undefined;
}
function listSpan(input: string, value: Span): Span[] {
  const tokens = (analyzeSyntax(value.text).tokens as MorphToken[]).map((token) => ({ ...token, start: token.start + value.start, end: token.end + value.start }));
  return splitCoordination(input, tokens, ['and']).members;
}
function possessive(input: string, value: Span): { owner: Span; property: Span } | undefined {
  const match = value.text.match(/^(.+?)(?:'s|’s)\s+(.+)$/i); if (!match || match.index === undefined) return undefined;
  const ownerStart = value.start + value.text.indexOf(match[1]);
  const propertyStart = value.start + value.text.lastIndexOf(match[2]);
  return { owner: span(input, ownerStart, ownerStart + match[1].length), property: span(input, propertyStart, propertyStart + match[2].length) };
}

export function semanticAnalysis(input: string, store: Store): SemanticClause {
  const ir = analyzeSyntax(input); const ts = words(ir); const ls = lemmas(ir);
  const consume = (construction: string) => { ir.construction = construction; ir.meaningfulCoverage = 1; ir.unconsumed = []; };
  const be = ls.findIndex((word) => word === 'be');
  const of = ls.lastIndexOf('of');
  const have = ls.findIndex((word) => word === 'have');
  const which = ls.findIndex((word) => word === 'which');

  for (const [markers, family] of unsupported) if (markers.every((marker) => ls.includes(marker))) {
    consume('capability-boundary');
    ir.intent = { kind: 'unsupported', family, reason: `That request is outside Lexi's deterministic ${family.replaceAll('-', ' ')} capability contract.` };
    return ir;
  }

  if (ls.includes('current') || ls.includes('latest') || ls.includes('today')) {
    consume('freshness-boundary');
    ir.intent = { kind: 'unsupported', family: 'current-information', reason: 'I cannot establish a current answer without time-valid evidence for this request.' };
    return ir;
  }

  // A bounded relational composition is recognized before the broader
  // property-of construction so its embedded clause cannot become an entity name.
  if (ls[0] === 'what' && be === 1 && ls[2] === 'the' && ls[3] === 'capital' && ls[4] === 'of' && ls[5] === 'the' && ls[6] === 'country' && ls[7] === 'where' && ls.at(-1) === 'born') {
    const embeddedBe = ls.lastIndexOf('be');
    const person = range(input, ts, 8, embeddedBe);
    if (person.text) {
      consume('nested-birthplace-country-capital');
      ir.intent = { kind: 'join', seed: person, atoms: [
        { subject: 'seed', relation: 'birthplace', object: 'birthplace' },
        { subject: 'birthplace', relation: 'country', object: 'country' },
        { subject: 'country', relation: 'capital', object: 'answer' },
      ], answer: 'answer' };
      return ir;
    }
  }

  // Relational-noun questions: property of subject, including ordered subject coordination.
  if (of > be && be >= 0 && ['what', 'which'].includes(ls[0])) {
    const inverseWh = ls[of + 1] === 'which' || ls[of + 1] === 'what' || ls[of + 1] === 'who';
    const propertyStart = be + 1 + (ls[be + 1] === 'the' ? 1 : 0);
    const propertySpan = range(input, ts, propertyStart, of);
    const relation = property(propertySpan.text, store);
    if (relation) {
      const answerNoun = range(input, ts, 1, be).text;
      if (answerNoun && !compatibleAnswerNoun(answerNoun, relation)) {
        consume('incompatible-answer-noun');
        ir.intent = { kind: 'unsupported', family: 'answer-type', reason: `The requested answer type is incompatible with the ${relation.replaceAll('_', ' ')} relation.` };
        return ir;
      }
      consume(inverseWh ? 'inverse-relational-noun' : 'property-of');
      ir.answerKind = inverseWh ? 'list' : 'value';
      ir.intent = inverseWh
        ? { kind: 'lookup', subjects: [], relations: [{ id: relation, span: propertySpan }], object: range(input, ts, 0, be), answerSide: 'subject', shape: 'list', polarity: 'positive' }
        : { kind: 'lookup', subjects: listSpan(input, range(input, ts, of + 1, ts.length)), relations: [{ id: relation, span: propertySpan }], answerSide: 'object', shape: 'value', polarity: 'positive' };
      return ir;
    }
  }

  // Declarative frame with a trailing answer variable: "Paris is the capital of which country?"
  if (be > 0 && of > be && ['which', 'what', 'who'].includes(ls[of + 1])) {
    const propertyStart = be + 1 + (ls[be + 1] === 'the' ? 1 : 0);
    const propertySpan = range(input, ts, propertyStart, of);
    const relation = property(propertySpan.text, store);
    if (relation) {
      consume('trailing-wh-relational-noun');
      ir.answerKind = 'list';
      ir.intent = { kind: 'lookup', subjects: [], relations: [{ id: relation, span: propertySpan }], object: range(input, ts, 0, be), answerSide: 'subject', shape: 'list', polarity: 'positive' };
      return ir;
    }
  }

  // "France has which capital" and inverse "Which country has Paris as its capital".
  if (have > 0 && which > have) {
    const propertySpan = range(input, ts, which + 1, ts.length); const relation = property(propertySpan.text, store);
    if (relation) {
      consume('have-wh-object');
      ir.intent = { kind: 'lookup', subjects: [range(input, ts, 0, have)], relations: [{ id: relation, span: propertySpan }], answerSide: 'object', shape: 'value', polarity: 'positive' };
      return ir;
    }
  }
  const as = indices(ls, ['as', 'its']);
  if (which === 0 && have > 1 && as > have) {
    const propertySpan = range(input, ts, as + 2, ts.length); const relation = property(propertySpan.text, store);
    if (relation) {
      consume('inverse-have-as');
      ir.intent = { kind: 'lookup', subjects: [], relations: [{ id: relation, span: propertySpan }], object: range(input, ts, have + 1, as), answerSide: 'subject', shape: 'list', polarity: 'positive' };
      return ir;
    }
  }

  // Demonym adjective: "the French capital".
  const capital = ls.indexOf('capital');
  if (capital > 0) {
    const adjective = ls[capital - 1];
    if (demonyms[adjective]) {
      consume('demonym-property');
      const offset = input.toLocaleLowerCase('en-US').indexOf(adjective);
      ir.intent = { kind: 'lookup', subjects: [{ start: offset, end: offset + adjective.length, text: demonyms[adjective] }], relations: [{ id: 'capital', span: range(input, ts, capital, capital + 1) }], answerSide: 'object', shape: 'value', polarity: 'positive' };
      return ir;
    }
  }

  // Possessive property, with one or more coordinated requested properties.
  const possessiveValue = possessive(input, range(input, ts, be >= 0 ? be + 1 : 0, ts.length));
  if (possessiveValue) {
    const relationMembers = listSpan(input, possessiveValue.property);
    const relations = relationMembers.map((item) => ({ id: property(item.text, store), span: item })).filter((item): item is { id: string; span: Span } => !!item.id);
    if (relations.length === relationMembers.length && relations.length) {
      consume('possessive-property');
      ir.intent = { kind: 'lookup', subjects: [possessiveValue.owner], relations, answerSide: 'object', shape: 'value', polarity: 'positive' };
      return ir;
    }
  }

  // "What city serves as France's capital".
  const servesAs = indices(ls, ['serve', 'as']);
  if (servesAs > 0) {
    const p = possessive(input, range(input, ts, servesAs + 2, ts.length));
    if (p) {
      const relation = property(p.property.text, store);
      if (relation) { consume('serve-as-possessive'); ir.intent = { kind: 'lookup', subjects: [p.owner], relations: [{ id: relation, span: p.property }], answerSide: 'object', shape: 'value', polarity: 'positive' }; return ir; }
    }
  }

  // Agent/patient alternations share one relation and only move the answer variable.
  if (ls[0] === 'who' && verbs[ls[1]]) {
    consume('active-agent'); ir.intent = { kind: 'lookup', subjects: [range(input, ts, 2, ts.length)], relations: [{ id: verbs[ls[1]], span: range(input, ts, 1, 2) }], answerSide: 'object', shape: 'value', polarity: 'positive' }; return ir;
  }
  if (indices(ls, ['by', 'whom']) === 0 && be === 2 && verbs[ls.at(-1)!]) {
    consume('fronted-passive-agent'); ir.intent = { kind: 'lookup', subjects: [range(input, ts, 3, ts.length - 1)], relations: [{ id: verbs[ls.at(-1)!], span: range(input, ts, ts.length - 1, ts.length) }], answerSide: 'object', shape: 'value', polarity: 'positive' }; return ir;
  }
  if (ls[0] === 'who' && be === 1 && ls.at(-1) === 'by' && verbs[ls.at(-2)!]) {
    consume('stranded-passive-agent'); ir.intent = { kind: 'lookup', subjects: [range(input, ts, 2, ts.length - 2)], relations: [{ id: verbs[ls.at(-2)!], span: range(input, ts, ts.length - 2, ts.length - 1) }], answerSide: 'object', shape: 'value', polarity: 'positive' }; return ir;
  }
  if (ls[0] === 'what' && ls[1] === 'do' && verbs[ls.at(-1)!]) {
    consume('active-patient'); ir.intent = { kind: 'lookup', subjects: [], relations: [{ id: verbs[ls.at(-1)!], span: range(input, ts, ts.length - 1, ts.length) }], object: range(input, ts, 2, ts.length - 1), answerSide: 'subject', shape: 'list', polarity: 'positive' }; return ir;
  }

  // Copular proposition(s), including scoped negation and conjunction.
  const clauseCoordination = splitCoordination(input, ir.tokens, ['and']);
  const propositions = clauseCoordination.members.map((member) => {
    const local = analyzeSyntax(member.text); const localTokens = words(local); const localLemmas = lemmas(local);
    const localBe = localLemmas.indexOf('be'); const localOf = localLemmas.lastIndexOf('of');
    if (localBe < 0 || localOf < localBe) return undefined;
    const inverted = localBe === 0;
    const objectStart = inverted ? 1 : 0;
    const negIndex = inverted ? localLemmas.indexOf('not', objectStart) : localBe + 1;
    const neg = negIndex >= 0 && negIndex < localOf;
    const articleIndex = inverted ? (neg ? negIndex + 1 : objectStart + 1) : localBe + 1 + (neg ? 1 : 0);
    const pStart = articleIndex + (localLemmas[articleIndex] === 'the' ? 1 : 0);
    const p = range(member.text, localTokens, pStart, localOf); const relation = property(p.text, store); if (!relation) return undefined;
    const shift = member.start;
    const object = inverted ? range(member.text, localTokens, objectStart, neg ? negIndex : articleIndex) : range(member.text, localTokens, 0, localBe);
    const subject = range(member.text, localTokens, localOf + 1, localTokens.length);
    return { subject: { ...subject, start: subject.start + shift, end: subject.end + shift }, relation, object: { ...object, start: object.start + shift, end: object.end + shift }, negative: neg };
  }).filter((value): value is NonNullable<typeof value> => !!value);
  if (propositions.length && propositions.length === clauseCoordination.members.length && (be === 0 || be > 0)) {
    consume('copular-verification'); ir.intent = { kind: 'verify', propositions }; return ir;
  }

  // Quantified ability and class statements.
  if (ir.quantifier && ['do', 'be'].includes(ls[0])) {
    let qEnd = ts.findIndex((token) => token.end >= ir.quantifier!.span.end) + 1;
    if (ir.quantifier.count !== undefined) {
      while (qEnd < ts.length && (numberWords(ts[qEnd].lemma) !== undefined || ['hundred', 'thousand', 'million', 'billion', 'and'].includes(ts[qEnd].lemma))) qEnd += 1;
    }
    const predicateIndex = ts.length - 1;
    const restriction = range(input, ts, qEnd, predicateIndex);
    if (restriction.text && predicateIndex > qEnd) {
      const action = ls[predicateIndex];
      consume('quantified-proposition');
      ir.intent = { kind: 'quantify', restriction, relation: action === 'fly' ? 'ability' : 'is_a', object: range(input, ts, predicateIndex, ts.length), quantifier: ir.quantifier, scope: action === 'fly' ? 'fly' : undefined };
      return ir;
    }
  }

  // Comparison language is typed; generic comparison asks for a metric.
  if (ls[0] === 'compare' || (ls[0] === 'which' && ls.includes('bigger')) || (ls[0] === 'which' && ls.includes('smaller'))) {
    const start = ls[0] === 'compare' ? 1 : Math.max(ls.indexOf('bigger'), ls.indexOf('smaller')) + 1;
    const value = range(input, ts, start, ts.length); const subjects = splitCoordination(input, analyzeSyntax(value.text).tokens.map((token) => ({ ...token, start: token.start + value.start, end: token.end + value.start })), ['and', 'or', 'with']).members;
    if (subjects.length === 2) { consume('generic-comparison'); ir.intent = { kind: 'compare', subjects, metric: ls[0] === 'which' ? 'diameter' : undefined, mode: 'qualitative', preference: ls.includes('smaller') ? 'lesser' : 'greater' }; return ir; }
  }
  if (ls[0] === 'what' && ls.includes('percentage') && (ls.includes('larger') || ls.includes('smaller'))) {
    const is = ls.indexOf('be'), than = ls.lastIndexOf('than');
    const inIndex = ls.lastIndexOf('in');
    if (is >= 0 && than > is) {
      const metric = inIndex > than ? property(range(input, ts, inIndex + 1, ts.length).text, store) : undefined;
      consume('percentage-comparison');
      ir.intent = { kind: 'compare', subjects: [range(input, ts, is + 1, than), range(input, ts, than + 1, inIndex > than ? inIndex : ts.length)], metric, mode: 'percentage', preference: ls.includes('smaller') ? 'lesser' : 'greater' };
      return ir;
    }
  }
  if (ls[0] === 'how' && ls[1] === 'much' && (ls[2] === 'larger' || ls[2] === 'smaller') && ls[3] === 'be') {
    const than = ls.lastIndexOf('than');
    if (than > 3) {
      consume('physical-size-difference');
      ir.intent = { kind: 'compare', subjects: [range(input, ts, 4, than), range(input, ts, than + 1, ts.length)], metric: 'diameter', mode: 'difference', preference: ls[2] === 'smaller' ? 'lesser' : 'greater' };
      return ir;
    }
  }

  return ir;
}

export function compositionalAlternatives(input: string, store: Store, state: State, resolve: (text: string, role: 'subject' | 'object', store: Store, state: State) => Term): Alternative[] {
  const ir = semanticAnalysis(input, store);
  const alternative = compileSemantic(ir, (text, role) => resolve(text, role, store, state));
  return alternative ? [alternative] : [];
}

/** Expands coordinated properties over one possessor into independently traceable clauses. */
export function expandSemanticClauses(input: string, store: Store): string[] {
  const ir = semanticAnalysis(input, store);
  if (ir.intent?.kind !== 'lookup' || ir.intent.relations.length < 2 || ir.intent.subjects.length !== 1) return [input];
  const owner = ir.intent.subjects[0].text;
  return ir.intent.relations.map((relation) => `What is ${owner}'s ${relation.span.text}?`);
}
