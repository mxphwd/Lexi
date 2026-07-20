import type { SentenceMode } from "@/lib/lexi/types";

export type BasicPhraseDefinition = {
  id: string;
  intent: string;
  patterns: RegExp[];
  response: string;
  evidence: string[];
  mode: SentenceMode;
};

export type BasicPhraseMatch = {
  definition: BasicPhraseDefinition;
  normalizedInput: string;
};
