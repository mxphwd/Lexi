import { checkAbort } from './types';

export type TokenKind = 'word' | 'number' | 'punctuation' | 'symbol' | 'space';
export type Token = {
  text: string;
  normalized: string;
  start: number;
  end: number;
  kind: TokenKind;
};

const word = /[\p{L}\p{M}]/u;
const number = /[\p{N}]/u;
const space = /\s/u;
const punctuation = /[.,!?;:()[\]{}"'’“”\-–—]/u;

/** Unicode-aware, lossless tokenization. Every input character belongs to one token. */
export function tokenize(input: string, signal?: AbortSignal): Token[] {
  const normalizedInput = input.normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const tokens: Token[] = [];
  let index = 0;
  while (index < normalizedInput.length) {
    checkAbort(signal);
    const start = index;
    const first = normalizedInput[index];
    const kind: TokenKind = word.test(first) ? 'word' : number.test(first) ? 'number' : space.test(first) ? 'space' : punctuation.test(first) ? 'punctuation' : 'symbol';
    index += 1;
    if (kind === 'word') {
      while (index < normalizedInput.length && (word.test(normalizedInput[index]) || number.test(normalizedInput[index]) || /['-]/.test(normalizedInput[index]))) index += 1;
    } else if (kind === 'number') {
      while (index < normalizedInput.length && /[\p{N},._]/u.test(normalizedInput[index])) index += 1;
    } else if (kind === 'space') {
      while (index < normalizedInput.length && space.test(normalizedInput[index])) index += 1;
    }
    const text = normalizedInput.slice(start, index);
    tokens.push({ text, normalized: text.toLocaleLowerCase('en-US'), start, end: index, kind });
  }
  return tokens;
}

export function meaningful<T extends Token>(tokens: readonly T[]): T[] {
  return tokens.filter((token) => token.kind !== 'space' && !(token.kind === 'punctuation' && /^[.!?]$/.test(token.text)));
}

export function tokenText(input: string, tokens: readonly Token[]): string {
  if (!tokens.length) return '';
  return input.slice(tokens[0].start, tokens[tokens.length - 1].end).trim();
}
