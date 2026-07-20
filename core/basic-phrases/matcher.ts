import { BASIC_PHRASES } from "./catalog";
import { normalizeBasicPhrase } from "./normalize";
import type { BasicPhraseMatch } from "./types";

export function matchBasicPhrase(input: string): BasicPhraseMatch | null {
  const normalizedInput = normalizeBasicPhrase(input);
  if (!normalizedInput) return null;

  for (const definition of BASIC_PHRASES) {
    if (definition.patterns.some((pattern) => pattern.test(normalizedInput))) {
      return { definition, normalizedInput };
    }
  }

  return null;
}
