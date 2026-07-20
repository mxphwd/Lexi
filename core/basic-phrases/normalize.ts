const CONTRACTIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bwhat's\b/g, "what is"],
  [/\bwho's\b/g, "who is"],
  [/\bhow's\b/g, "how is"],
  [/\bi'm\b/g, "i am"],
  [/\byou're\b/g, "you are"],
  [/\bit's\b/g, "it is"],
  [/\bthat's\b/g, "that is"],
  [/\bdon't\b/g, "do not"],
];

export function normalizeBasicPhrase(input: string): string {
  let normalized = input
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’‘]/g, "'");

  for (const [contraction, expanded] of CONTRACTIONS) {
    normalized = normalized.replace(contraction, expanded);
  }

  return normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
