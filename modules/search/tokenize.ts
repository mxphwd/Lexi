import type { SentenceAnalysis, SentenceMode } from "@/lib/lexi/types";

const contractions: Record<string, string> = {
  "what's": "what is",
  "who's": "who is",
  "how's": "how is",
  "can't": "cannot",
  "won't": "will not",
  "don't": "do not",
  "doesn't": "does not",
  "isn't": "is not",
  "aren't": "are not",
  "i'm": "i am",
  "you're": "you are",
  "it's": "it is",
  "that's": "that is",
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "does",
  "for",
  "from",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
]);

const auxiliaryStarts = new Set([
  "am",
  "are",
  "can",
  "could",
  "did",
  "do",
  "does",
  "has",
  "have",
  "is",
  "may",
  "should",
  "was",
  "were",
  "will",
  "would",
]);

const imperativeStarts = new Set([
  "define",
  "describe",
  "explain",
  "find",
  "give",
  "help",
  "show",
  "stop",
  "tell",
]);

const questionWords = new Set([
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
]);

export function normalizeText(value: string): string {
  let normalized = value.normalize("NFKC").toLocaleLowerCase("en-US").trim();

  for (const [contraction, expansion] of Object.entries(contractions)) {
    normalized = normalized.replaceAll(contraction, expansion);
  }

  return normalized
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  return normalized ? normalized.match(/[\p{L}\p{N}]+(?:'[\p{L}]+)?/gu) ?? [] : [];
}

export function contentTokens(tokens: string[]): string[] {
  return tokens.filter((token) => !stopWords.has(token) && token.length > 1);
}

export function detectSentenceMode(value: string, tokens: string[]): SentenceMode {
  const first = tokens[0];
  if (value.trim().endsWith("!")) return "exclamative";
  if (
    value.trim().endsWith("?") ||
    questionWords.has(first) ||
    auxiliaryStarts.has(first)
  ) {
    return "interrogative";
  }
  if (imperativeStarts.has(first)) return "imperative";
  return "declarative";
}

export function analyseSentence(value: string): SentenceAnalysis {
  const tokens = tokenize(value);
  const mode = detectSentenceMode(value, tokens);
  const questionWord = questionWords.has(tokens[0]) ? tokens[0] : undefined;
  const subjectIndex = questionWord ? 1 : 0;
  const subject = tokens[subjectIndex];
  const predicate = tokens[subjectIndex + 1];
  const object = tokens.slice(subjectIndex + 2).join(" ") || undefined;

  return {
    original: value,
    normalized: normalizeText(value),
    tokens,
    contentTokens: contentTokens(tokens),
    mode,
    questionWord,
    subject,
    predicate,
    object,
  };
}

const supportedNeutralCharacters = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}\p{M}]*$/u;

export function hasUnsupportedWritingSystem(value: string): boolean {
  return value.length > 0 && !supportedNeutralCharacters.test(value);
}
