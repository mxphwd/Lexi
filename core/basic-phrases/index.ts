import { BASIC_PHRASES } from "./catalog";

export { matchBasicPhrase } from "./matcher";
export { normalizeBasicPhrase } from "./normalize";
export type { BasicPhraseDefinition, BasicPhraseMatch } from "./types";

export const basicPhrasePatternCount = BASIC_PHRASES.reduce(
  (count, definition) => count + definition.patterns.length,
  0,
);
