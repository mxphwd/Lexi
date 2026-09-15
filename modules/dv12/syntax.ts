import { numberWords } from './numbers';
import { analyzeMorphology, type MorphToken } from './morphology';
import { meaningful, tokenize, tokenText } from './tokenizer';
import { span, type Coordination, type Phrase, type QuantifierExpression, type SemanticClause, type Span } from './semantic-ir';

const quantifiers = new Set(['all', 'any', 'some', 'none', 'most', 'exactly']);

function punctuationDepth(tokens: readonly MorphToken[], index: number) {
  let depth = 0;
  for (let i = 0; i < index; i += 1) {
    if (tokens[i].text === '(' || tokens[i].text === '[' || tokens[i].text === '{') depth += 1;
    if (tokens[i].text === ')' || tokens[i].text === ']' || tokens[i].text === '}') depth -= 1;
  }
  return depth;
}

export function splitCoordination(input: string, tokens: readonly MorphToken[], conjunctions = ['and']): { members: Span[]; conjunction?: string } {
  const significant = tokens.filter((token) => token.kind !== 'space');
  const boundaries: Array<{ start: number; end: number; conjunction: string }> = [];
  for (let index = 0; index < significant.length; index += 1) {
    const token = significant[index];
    if (punctuationDepth(significant, index) !== 0) continue;
    if (token.text === ',') boundaries.push({ start: token.start, end: token.end, conjunction: ',' });
    else if (conjunctions.includes(token.lemma)) boundaries.push({ start: token.start, end: token.end, conjunction: token.lemma });
  }
  if (!boundaries.length) return { members: [span(input, significant[0]?.start ?? 0, significant.at(-1)?.end ?? input.length)] };
  const members: Span[] = [];
  let start = significant[0]?.start ?? 0;
  for (const boundary of boundaries) {
    const item = span(input, start, boundary.start);
    if (item.text.trim()) members.push({ ...item, text: item.text.trim() });
    start = boundary.end;
  }
  const last = span(input, start, significant.at(-1)?.end ?? input.length);
  if (last.text.trim()) members.push({ ...last, text: last.text.trim() });
  return { members, conjunction: boundaries.at(-1)?.conjunction };
}

function quantifier(tokens: readonly MorphToken[], input: string): QuantifierExpression | undefined {
  const words = meaningful(tokens);
  const at = words.findIndex((token, index) => token.lemma === 'at' && ['least', 'most'].includes(words[index + 1]?.lemma));
  const first = words.findIndex((token) => quantifiers.has(token.lemma));
  const index = at >= 0 ? at : first;
  if (index < 0) return undefined;
  const token = words[index];
  const phrase = at >= 0 ? `${words[index].lemma} ${words[index + 1].lemma}` : token.lemma;
  const kind = phrase === 'some' ? 'any' : phrase === 'exactly' ? 'exact' : phrase === 'at least' ? 'minimum' : phrase === 'at most' ? 'maximum' : phrase as QuantifierExpression['kind'];
  let end = at >= 0 ? index + 2 : index + 1;
  let count: number | undefined;
  if (['exact', 'minimum', 'maximum'].includes(kind)) {
    const numberTokens: MorphToken[] = [];
    while (end < words.length && (/^\d/.test(words[end].text) || numberWords(words[end].lemma) !== undefined || ['hundred', 'thousand', 'million', 'and'].includes(words[end].lemma))) {
      numberTokens.push(words[end]); end += 1;
    }
    count = numberWords(tokenText(input, numberTokens));
  }
  const endOffset = words[Math.max(index, end - 1)]?.end ?? token.end;
  return { kind, count, span: span(input, token.start, endOffset) };
}

/** Produces a lossless syntactic inventory before entity binding or plan selection. */
export function analyzeSyntax(input: string, signal?: AbortSignal): SemanticClause {
  const tokens = analyzeMorphology(tokenize(input, signal));
  const words = meaningful(tokens);
  const phrases: Phrase[] = [];
  const coordination: Coordination[] = [];
  const coordinated = splitCoordination(input, tokens, ['and', 'or', 'but', 'then']);
  if (coordinated.members.length > 1) {
    const conjunction = coordinated.conjunction ?? 'and';
    coordination.push({
      kind: conjunction === 'or' ? 'alternative' : conjunction === 'but' ? 'contrast' : conjunction === 'then' ? 'sequence' : 'clauses',
      members: coordinated.members,
      conjunction,
    });
  }
  const prepositions = new Set(['of', 'by', 'in', 'on', 'at', 'from', 'to', 'with', 'for', 'before', 'after', 'during', 'since', 'until']);
  for (const token of words) {
    if (prepositions.has(token.lemma)) phrases.push({ ...span(input, token.start, token.end), kind: 'preposition', head: token.lemma });
  }
  return {
    version: 1,
    original: input,
    tokens,
    phrases,
    coordination,
    temporal: [],
    quantifier: quantifier(tokens, input),
    meaningfulCoverage: words.length ? 0 : 1,
    unconsumed: words.length ? [span(input, words[0].start, words.at(-1)!.end)] : [],
  };
}
