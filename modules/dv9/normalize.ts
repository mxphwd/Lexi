/** Lexical normalization preserves punctuation that distinguishes dictionary headwords. */
export function dv9NormalizeLexical(value: string): string {
  const original = value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\bwhat's\b/g, "what is")
    .replace(/\bwho's\b/g, "who is")
    .trim();
  const withoutSentenceMark = /[?!]$/.test(original)
    ? original.slice(0, -1)
    : original.endsWith("..")
      ? original.slice(0, -1)
      : original.endsWith(".")
        ? original.slice(0, -1)
        : original;
  return withoutSentenceMark
    .replace(/[^\p{L}\p{N}'./\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dv9LexicalLookupForms(value: string) {
  const exact = dv9NormalizeLexical(value);
  const withoutWrapper = exact.replace(/^(?:the|a|an)\s+/, "");
  return [...new Set([exact, withoutWrapper].filter(Boolean))];
}
