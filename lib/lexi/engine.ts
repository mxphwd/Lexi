import contextPages from "@/data/example-contexts/catalog";
import { connectWords } from "@/modules/connect";
import { determineContext } from "@/modules/context";
import { searchContexts } from "@/modules/search";
import { realiseSentence } from "@/modules/structure";
import type { ContextEntry, LexiReply } from "./types";

const entries: ContextEntry[] = contextPages.flatMap((page) => page.entries);

export function respond(input: string): LexiReply {
  const { analysis, matches } = searchContexts(input, entries);
  const decision = determineContext(analysis, matches);
  const connected = connectWords(analysis, decision);
  const realised = realiseSentence(decision, connected);
  const bestMatch = matches[0];
  const exact = bestMatch?.phraseScore > 0.96;
  const known = decision.intent !== "unknown";

  return {
    text: realised.text,
    trace: {
      normalizedInput: analysis.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent: decision.intent,
      confidence: Number(decision.confidence.toFixed(2)),
      matchedExampleIds: matches.slice(0, 3).map((match) => match.entry.id),
      matchedTerms: decision.evidence,
      selectedStructure: realised.structureId,
      source: exact ? "exact-example" : known ? "context-pattern" : "safe-fallback",
    },
  };
}

export function corpusStats() {
  return {
    pages: contextPages.length,
    examples: entries.length,
    sentences: entries.length * 2,
  };
}
