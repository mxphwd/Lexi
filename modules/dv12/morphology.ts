import type { Token } from './tokenizer';

const irregular: Record<string, string> = {
  are: 'be', is: 'be', was: 'be', were: 'be', been: 'be',
  has: 'have', had: 'have', does: 'do', did: 'do', done: 'do',
  wrote: 'write', written: 'write', invented: 'invent', created: 'create',
  discovered: 'discover', known: 'know', countries: 'country', cities: 'city',
  people: 'person', children: 'child', men: 'man', women: 'woman',
  mice: 'mouse', feet: 'foot', geese: 'goose',
};

export function lemma(word: string): string {
  const value = word.toLocaleLowerCase('en-US');
  if (irregular[value]) return irregular[value];
  if (value.length > 4 && value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.length > 5 && value.endsWith('ing')) return value.slice(0, -3).replace(/([b-df-hj-np-tv-z])\1$/, '$1');
  if (value.length > 4 && value.endsWith('ed')) return value.slice(0, -2).replace(/([b-df-hj-np-tv-z])\1$/, '$1');
  if (value.length > 3 && value.endsWith('s') && !/(?:ss|us|is)$/.test(value)) return value.slice(0, -1);
  return value;
}

export type MorphToken = Token & { lemma: string };

export function analyzeMorphology(tokens: readonly Token[]): MorphToken[] {
  return tokens.map((token) => ({ ...token, lemma: token.kind === 'word' ? lemma(token.normalized) : token.normalized }));
}
