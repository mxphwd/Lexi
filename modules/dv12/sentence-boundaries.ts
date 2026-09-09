const prefixAbbreviations = new Set([
  'mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'rev', 'fr', 'hon', 'pres',
  'gov', 'sen', 'rep', 'gen', 'col', 'maj', 'capt', 'cmdr', 'lt', 'sgt',
  'cpl', 'adm', 'sir', 'dame', 'lord', 'lady', 'st', 'mt',
]);

const continuationAbbreviations = new Set([
  'co', 'corp', 'inc', 'ltd', 'plc', 'dept', 'div', 'est', 'univ',
  'assoc', 'bros', 'no', 'nos', 'fig', 'vol', 'pp', 'apt', 'ste',
  'vs', 'approx', 'misc', 'etc',
]);

const suffixAbbreviations = new Set([
  'jr', 'sr', 'esq', 'phd', 'md', 'dds', 'dvm', 'jd', 'ii', 'iii', 'iv',
]);

const explicitSentenceStarter = /^(?:what|who|where|when|why|how|which|can|could|would|should|may|does|do|did|is|are|am|was|were|will|have|has|had|i|you|we|they|he|she|it|this|that|these|those|there|please|tell|show|give|explain|define|list|name|forget|remember|actually|however)\b/iu;

function trailingWord(text: string): { raw: string; normalized: string } | undefined {
  const match = text.match(/([\p{L}]+)\.$/u);
  if (!match) return undefined;
  return { raw: match[1], normalized: match[1].toLocaleLowerCase('en-US') };
}

/**
 * Decide whether a full stop is structural punctuation or belongs to an
 * abbreviation. The caller has already excluded quoted and parenthesized text.
 *
 * Abbreviations are protected only when the following text looks like a
 * continuation. A clear new request still splits after suffixes such as Sr.
 * and acronyms such as U.S., so one protected token cannot absorb the next
 * sentence.
 */
export function periodTerminatesClause(input: string, index: number, clauseStart: number): boolean {
  const previous = input[index - 1] ?? '';
  const next = input[index + 1] ?? '';
  if (/\d/u.test(previous) && /\d/u.test(next)) return false;
  if (next && !/\s/u.test(next)) return false;

  const before = input.slice(clauseStart, index + 1);
  const after = input.slice(index + 1).trimStart();
  if (!after) return true;

  const word = trailingWord(before);
  const beginsNewSentence = explicitSentenceStarter.test(after);
  const isInitial = Boolean(word && /^\p{Lu}$/u.test(word.raw));
  const isDottedAbbreviation = /(?:\p{L}\.){2,}$/u.test(before);
  const isKnownAbbreviation = Boolean(word && (
    prefixAbbreviations.has(word.normalized)
    || continuationAbbreviations.has(word.normalized)
    || suffixAbbreviations.has(word.normalized)
  ));

  if ((isInitial || isDottedAbbreviation || isKnownAbbreviation) && !beginsNewSentence) {
    return false;
  }
  return true;
}
