import type { ContextDecision, ContextEntry, SentenceAnalysis } from "@/lib/lexi/types";
import { runtimeDictionary, runtimeThesaurus } from "@/modules/search/thesaurus";

export type ConnectedWords = {
  subject: string;
  action: string;
  object: string;
  qualifier?: string;
  sourceEntry?: ContextEntry;
};

function extractRequestedTerm(analysis: SentenceAnalysis): string | undefined {
  const markers = ["define", "mean", "meaning", "synonym", "synonyms", "of", "for"];
  const candidates = analysis.tokens.filter((token) => !markers.includes(token));
  return candidates.at(-1);
}

export function connectWords(
  analysis: SentenceAnalysis,
  decision: ContextDecision,
  contextEntries: ContextEntry[] = [],
): ConnectedWords {
  const sourceEntry = decision.topMatches.find(
    (match) => match.entry.intent === decision.intent,
  )?.entry ?? contextEntries.find((entry) => entry.intent === decision.intent);
  const term = extractRequestedTerm(analysis);

  if (decision.intent === "synonym" && term) {
    const related = runtimeThesaurus[term];
    return {
      subject: term,
      action: related?.length ? "connects with" : "has no compact-index match for",
      object: related?.slice(0, 6).join(", ") ?? term,
      qualifier: related?.length ? "in the current Moby-derived runtime graph" : undefined,
      sourceEntry,
    };
  }

  if (decision.intent === "definition" && term) {
    const meaning = runtimeDictionary[term]?.meanings[0];
    return {
      subject: term,
      action: meaning ? "means" : "is not defined in",
      object: meaning?.definition ?? "the current compact Wordset index",
      qualifier: meaning?.partOfSpeech ? `(${meaning.partOfSpeech})` : undefined,
      sourceEntry,
    };
  }

  return {
    subject: sourceEntry?.slots?.subject ?? "Lexi",
    action: sourceEntry?.slots?.action ?? "matches",
    object: sourceEntry?.slots?.object ?? "the closest recorded context",
    qualifier: sourceEntry?.slots?.qualifier,
    sourceEntry,
  };
}
