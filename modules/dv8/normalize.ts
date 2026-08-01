import { normalizeText } from "@/modules/search/tokenize";

const irregularLemmas: Readonly<Record<string, string>> = {
  are: "be",
  is: "be",
  was: "be",
  were: "be",
  has: "have",
  had: "have",
  does: "do",
  did: "do",
  children: "child",
  people: "person",
  men: "man",
  women: "woman",
  mice: "mouse",
  geese: "goose",
  feet: "foot",
  teeth: "tooth",
  countries: "country",
  cities: "city",
  species: "species",
};

export function dv8Normalize(value: string): string {
  return normalizeText(
    value
      .normalize("NFKC")
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐‑–—]/g, "-")
      .replace(/\bwhat's\b/gi, "what is")
      .replace(/\bwho's\b/gi, "who is")
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bdoesn't\b/gi, "does not")
      .replace(/\bisn't\b/gi, "is not")
      .replace(/\baren't\b/gi, "are not")
      .replace(/\bdon't\b/gi, "do not"),
  )
    .replace(/[^a-z0-9.'%+\-/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dv8Tokens(value: string): string[] {
  return dv8Normalize(value).match(/[a-z0-9]+(?:'[a-z]+)?|[%+\-/]/g) ?? [];
}

export function lemma(token: string): string {
  const normalized = token.toLowerCase();
  if (irregularLemmas[normalized]) return irregularLemmas[normalized];
  if (normalized.length > 4 && normalized.endsWith("ies")) {
    return `${normalized.slice(0, -3)}y`;
  }
  if (normalized.length > 5 && normalized.endsWith("ing")) {
    const stem = normalized.slice(0, -3);
    return stem.length > 2 && stem.at(-1) === stem.at(-2) ? stem.slice(0, -1) : stem;
  }
  if (normalized.length > 4 && normalized.endsWith("ed")) {
    return normalized.slice(0, -2);
  }
  if (normalized.length > 3 && normalized.endsWith("es")) {
    return normalized.slice(0, -2);
  }
  if (normalized.length > 3 && normalized.endsWith("s") && !normalized.endsWith("ss")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function lexicalForms(value: string): string[] {
  const tokens = dv8Tokens(value);
  const lemmas = tokens.map(lemma);
  return [...new Set([tokens.join(" "), lemmas.join(" ")].filter(Boolean))];
}

export function contentTokens(value: string): string[] {
  const stop = new Set([
    "a", "an", "the", "of", "to", "in", "on", "at", "for", "from", "by",
    "what", "which", "who", "where", "when", "why", "how", "do", "does",
    "did", "be", "is", "are", "was", "were", "can", "could", "would", "please",
    "tell", "me", "about", "it", "its", "that", "this",
  ]);
  return dv8Tokens(value).map(lemma).filter((token) => !stop.has(token));
}

export function phraseCompatible(left: string, right: string): boolean {
  const a = contentTokens(left);
  const b = contentTokens(right);
  if (!a.length || !b.length) return false;
  const leftSet = new Set(a);
  const rightSet = new Set(b);
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  return intersection / Math.min(leftSet.size, rightSet.size) >= 0.67;
}
