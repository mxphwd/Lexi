const numberWords: Readonly<Record<string, number>> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

export function dv10Normalize(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toLocaleLowerCase("en-US")
    .replace(/\bwhat's\b/g, "what is")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/[^\p{L}\p{N}'./+\-]+/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
}

export function dv10Number(value: string | undefined) {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  return numberWords[dv10Normalize(value)];
}

export function dv10Tokens(value: string) {
  return dv10Normalize(value).split(" ").filter(Boolean);
}

export function dv10ContentTokens(value: string) {
  const stop = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "do", "does", "for", "from",
    "how", "i", "in", "is", "it", "me", "of", "on", "or", "the", "to", "was", "what",
    "when", "where", "which", "who", "why", "with", "would", "you",
  ]);
  return dv10Tokens(value).filter((token) => !stop.has(token));
}
