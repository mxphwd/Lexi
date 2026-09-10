export type PunctuationFastPath = {
  text: string;
  start: number;
  kind: 'inert-terminal-punctuation';
};

/**
 * Remove terminal question/exclamation markers only when the input is plainly
 * one clause and the symbols cannot be part of a supported operation.
 *
 * Internal punctuation, decimals, abbreviations, quoted punctuation,
 * semicolons, and factorial-looking exclamation marks keep the full parser.
 */
export function inertTerminalPunctuation(input: string): PunctuationFastPath | undefined {
  const start = input.length - input.trimStart().length;
  const trimmed = input.trim();
  const suffix = trimmed.match(/[!?！？]+$/u);
  if (!suffix) return undefined;

  const text = trimmed.slice(0, suffix.index).trimEnd();
  if (!text || /[.!?！？;；]/u.test(text)) return undefined;

  const marks = suffix[0].replaceAll('？', '?').replaceAll('！', '!');
  if (!marks.includes('?') && /[\d)\]]$/u.test(text)) return undefined;

  return { text, start, kind: 'inert-terminal-punctuation' };
}
