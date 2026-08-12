import type { SentenceMode } from "@/lib/lexi/types";
import { splitIntoClauses } from "@/modules/discourse/segment";
import type { Dv11NormalizedRequest, Dv11SourceSpan } from "./types";

const contractions: ReadonlyArray<[RegExp, string]> = [
  [/\bcan't\b/giu, "cannot"],
  [/\bwon't\b/giu, "will not"],
  [/\bshan't\b/giu, "shall not"],
  [/\bwhat's\b/giu, "what is"],
  [/\bwho's\b/giu, "who is"],
  [/\bwhere's\b/giu, "where is"],
  [/\bwhen's\b/giu, "when is"],
  [/\bwhy's\b/giu, "why is"],
  [/\bhow's\b/giu, "how is"],
  [/\bit's\b/giu, "it is"],
  [/\bthat's\b/giu, "that is"],
  [/\bthere's\b/giu, "there is"],
  [/\bdoesn't\b/giu, "does not"],
  [/\bdon't\b/giu, "do not"],
  [/\bdidn't\b/giu, "did not"],
  [/\bisn't\b/giu, "is not"],
  [/\baren't\b/giu, "are not"],
  [/\bwasn't\b/giu, "was not"],
  [/\bweren't\b/giu, "were not"],
  [/\bhasn't\b/giu, "has not"],
  [/\bhaven't\b/giu, "have not"],
  [/\bhadn't\b/giu, "had not"],
  [/\bwouldn't\b/giu, "would not"],
  [/\bshouldn't\b/giu, "should not"],
  [/\bcouldn't\b/giu, "could not"],
  [/\bi'm\b/giu, "i am"],
  [/\byou're\b/giu, "you are"],
  [/\bwe're\b/giu, "we are"],
  [/\bthey're\b/giu, "they are"],
  [/\bi've\b/giu, "i have"],
  [/\byou've\b/giu, "you have"],
  [/\bwe've\b/giu, "we have"],
  [/\bthey've\b/giu, "they have"],
  [/\bi'll\b/giu, "i will"],
  [/\byou'll\b/giu, "you will"],
  [/\bwe'll\b/giu, "we will"],
  [/\bthey'll\b/giu, "they will"],
];

const numberValues: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

const scales: Record<string, number> = {
  hundred: 100,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
};

export function dv11NormalizeText(input: string): string {
  let value = input
    .normalize("NFKC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\u00a0/g, " ")
    .toLocaleLowerCase("en-US");
  for (const [pattern, replacement] of contractions) value = value.replace(pattern, replacement);
  return value
    .replace(/([^\p{L}\p{N}\s.'"%+\-*/<>=(),:;?!])/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dv11Tokens(value: string): string[] {
  return dv11NormalizeText(value).match(/[+-]?\d+(?:\.\d+)?|[\p{L}\p{M}]+(?:[-'][\p{L}\p{M}]+)*|[%+*/<>=-]/gu) ?? [];
}

export function dv11Number(value: string): number | undefined {
  const normalized = dv11NormalizeText(value).replace(/,/g, "").trim();
  if (/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized);
  const words = normalized.split(/[ -]+/).filter((word) => word !== "and");
  if (!words.length || words.some((word) => numberValues[word] === undefined && scales[word] === undefined)) return undefined;
  let total = 0;
  let group = 0;
  for (const word of words) {
    if (numberValues[word] !== undefined) {
      group += numberValues[word];
      continue;
    }
    const scale = scales[word];
    if (scale === 100) group = Math.max(group, 1) * scale;
    else {
      total += Math.max(group, 1) * scale;
      group = 0;
    }
  }
  return total + group;
}

function sentenceMode(normalized: string): SentenceMode {
  if (/^(?:who|what|when|where|why|which|whose|how|is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b/.test(normalized)) return "interrogative";
  if (/^(?:tell|give|show|list|name|define|explain|compare|calculate|find|sort|convert|remember|forget|correct)\b/.test(normalized)) return "imperative";
  if (/!$/.test(normalized)) return "exclamative";
  return "declarative";
}

function canSplitAt(text: string, index: number, delimiterLength: number): boolean {
  let quote: string | undefined;
  let depth = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    const character = text[cursor];
    if ((character === '"' || character === "'") && text[cursor - 1] !== "\\") {
      quote = quote === character ? undefined : quote ?? character;
    }
    if (quote) continue;
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth = Math.max(0, depth - 1);
  }
  if (quote || depth > 0) return false;
  const tail = text.slice(index + delimiterLength).trim();
  return tail.length > 0;
}

export function splitDv11Clauses(original: string): Dv11SourceSpan[] {
  // A quantitative state setup and its dependent question form one executable
  // clause even when the author uses a sentence boundary between them.
  if (/\b(?:i|we)\s+have\s+(?:[+-]?\d+(?:\.\d+)?|[\p{L}-]+)\s+.+?\b(?:buy|bought|get|got|receive|received|lose|lost|use|used)\s+(?:[+-]?\d+(?:\.\d+)?|[\p{L}-]+).*[.!?]\s*how many\b/iu.test(original)) {
    const text = original.trim();
    const start = original.indexOf(text);
    return [{ start, end: start + text.length, text }];
  }
  if (!/["'()[\]{}]/.test(original)) {
    const expanded = splitIntoClauses(original);
    if (expanded.length > 1) {
      return expanded.map((text, index) => ({ start: index, end: index + text.length, text }));
    }
  }
  const boundaries: Array<{ index: number; length: number }> = [];
  const hard = /[?!.;]+\s+|\s+(?:and then|then|but also|however|meanwhile)\s+/giu;
  for (const match of original.matchAll(hard)) {
    if (match.index !== undefined && canSplitAt(original, match.index, match[0].length)) {
      boundaries.push({ index: match.index, length: match[0].length });
    }
  }

  const normalized = dv11NormalizeText(original);
  const pairedQuestion = /\b(?:and|or|but)\s+(?:who|what|when|where|why|which|whose|how|is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b/giu;
  for (const match of original.matchAll(pairedQuestion)) {
    if (match.index !== undefined && canSplitAt(original, match.index, match[0].length)) {
      const connectorLength = match[0].match(/^\s*(?:and|or|but)\s+/i)?.[0].length ?? 0;
      boundaries.push({ index: match.index, length: connectorLength });
    }
  }

  if (!boundaries.length || normalized.length === 0) {
    const text = original.trim();
    const start = original.indexOf(text);
    return text ? [{ start, end: start + text.length, text }] : [];
  }

  const unique = [...new Map(boundaries.map((boundary) => [boundary.index, boundary])).values()]
    .sort((left, right) => left.index - right.index);
  const spans: Dv11SourceSpan[] = [];
  let start = 0;
  for (const boundary of unique) {
    const raw = original.slice(start, boundary.index).trim();
    if (raw) {
      const actualStart = original.indexOf(raw, start);
      spans.push({ start: actualStart, end: actualStart + raw.length, text: raw });
    }
    start = boundary.index + boundary.length;
  }
  const tail = original.slice(start).trim();
  if (tail) {
    const actualStart = original.indexOf(tail, start);
    spans.push({ start: actualStart, end: actualStart + tail.length, text: tail });
  }
  return spans;
}

export function normalizeDv11Request(
  original: string,
  limits: { maximumCharacters: number; maximumTokens: number; maximumClauses: number; maximumOperations: number },
): Dv11NormalizedRequest {
  const normalized = dv11NormalizeText(original);
  const tokens = dv11Tokens(normalized);
  const clauses = splitDv11Clauses(original);
  const estimatedOperations = clauses.length + tokens.filter((token) => ["and", "or", "if", "than", "per"].includes(token)).length;
  const warnings: string[] = [];
  if (original.length > limits.maximumCharacters) warnings.push("limit:characters");
  if (tokens.length > limits.maximumTokens) warnings.push("limit:tokens");
  if (clauses.length > limits.maximumClauses) warnings.push("limit:clauses");
  if (estimatedOperations > limits.maximumOperations) warnings.push("limit:operations");
  const letters = normalized.match(/\p{L}/gu) ?? [];
  const latinLetters = normalized.match(/\p{Script=Latin}/gu) ?? [];
  return {
    id: `request:${stableHash(original)}`,
    original,
    normalized,
    tokens,
    clauses,
    mode: sentenceMode(normalized),
    language: letters.length === 0 || latinLetters.length / letters.length >= 0.9 ? "en" : "und",
    complexity: { characters: original.length, tokens: tokens.length, clauses: clauses.length, estimatedOperations },
    warnings,
  };
}

export function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
