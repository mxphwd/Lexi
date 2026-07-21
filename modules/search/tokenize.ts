import type { SentenceAnalysis, SentenceMode } from "@/lib/lexi/types";

const contractions: Record<string, string> = {
  "what's": "what is",
  "who's": "who is",
  "how's": "how is",
  "can't": "cannot",
  "won't": "will not",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "couldn't": "could not",
  "haven't": "have not",
  "hasn't": "has not",
  "i'm": "i am",
  "i'll": "i will",
  "i'd": "i would",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "there's": "there is",
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
  let normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'")
    .trim();

  for (const [contraction, expansion] of Object.entries(contractions)) {
    normalized = normalized.replaceAll(contraction, expansion);
  }

  return normalized
    .replace(/[“”]/g, '"')
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
  const first = tokens[tokens[0] === "please" ? 1 : 0];
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
  const leadingIndex = tokens[0] === "please" ? 1 : 0;
  const first = tokens[leadingIndex];
  const questionWord = questionWords.has(first) ? first : undefined;
  let auxiliary: string | undefined;
  let subject: string | undefined;
  let predicate: string | undefined;
  let object: string | undefined;

  if (questionWord && auxiliaryStarts.has(tokens[leadingIndex + 1])) {
    auxiliary = tokens[leadingIndex + 1];
    const remainder = tokens.slice(leadingIndex + 2);
    if (["do", "does", "did"].includes(auxiliary) && remainder.length > 1) {
      subject = remainder.slice(0, -1).join(" ");
      predicate = remainder.at(-1);
    } else {
      subject = remainder[0];
      predicate = remainder[1];
      object = remainder.slice(2).join(" ") || undefined;
    }
  } else if (questionWord) {
    subject = tokens[leadingIndex + 1];
    predicate = tokens[leadingIndex + 2];
    object = tokens.slice(leadingIndex + 3).join(" ") || undefined;
  } else if (auxiliaryStarts.has(first)) {
    auxiliary = first;
    subject = tokens[leadingIndex + 1];
    predicate = tokens[leadingIndex + 2];
    object = tokens.slice(leadingIndex + 3).join(" ") || undefined;
  } else if (imperativeStarts.has(first)) {
    subject = "you";
    predicate = first;
    object = tokens.slice(leadingIndex + 1).join(" ") || undefined;
  } else {
    subject = first;
    predicate = tokens[leadingIndex + 1];
    object = tokens.slice(leadingIndex + 2).join(" ") || undefined;
  }

  return {
    original: value,
    normalized: normalizeText(value),
    tokens,
    contentTokens: contentTokens(tokens),
    mode,
    questionWord,
    auxiliary,
    negated: tokens.some((token) => token === "not" || token === "never" || token === "cannot"),
    subject,
    predicate,
    object,
  };
}

const supportedNeutralCharacters = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Z}\p{M}]*$/u;

export function hasUnsupportedWritingSystem(value: string): boolean {
  return value.length > 0 && !supportedNeutralCharacters.test(value);
}
