import contextPages from "@/data/example-contexts/catalog";
import { basicPhrasePatternCount, matchBasicPhrase } from "@/core/basic-phrases";
import { connectWords } from "@/modules/connect";
import { determineContext } from "@/modules/context";
import {
  extractDefinitionTerm,
  findWordsetEntry,
  type DictionaryLookupOptions,
} from "@/modules/dictionary";
import {
  combineClauseReplies,
  discourseReferenceFeatureCount,
  hasUnresolvedReference,
  splitIntoClauses,
} from "@/modules/discourse";
import {
  extendedPackStats,
  matchExtendedPack,
  prepareLinguisticInput,
} from "@/modules/extended-pack";
import { analyseSentence, searchContexts } from "@/modules/search";
import { realiseSentence } from "@/modules/structure";
import type { ContextEntry, LexiReply } from "./types";

const entries: ContextEntry[] = contextPages.flatMap((page) => page.entries);

function respondToClause(input: string): LexiReply {
  const prepared = prepareLinguisticInput(input);
  const basicPhrase =
    matchBasicPhrase(input) ??
    (prepared.core !== prepared.originalNormalized
      ? matchBasicPhrase(prepared.core)
      : undefined);
  if (basicPhrase) {
    const { definition, normalizedInput } = basicPhrase;

    return {
      text: definition.response,
      trace: {
        normalizedInput,
        sentenceMode: definition.mode,
        interpretedIntent: definition.intent,
        confidence: 1,
        matchedExampleIds: [`core:${definition.id}`],
        matchedTerms: definition.evidence,
        selectedStructure: `core:${definition.id}`,
        source: "core-phrase",
      },
    };
  }

  const extended = matchExtendedPack(input);
  if (extended) {
    const analysis = analyseSentence(input);
    return {
      text: extended.text,
      trace: {
        normalizedInput: analysis.normalized,
        sentenceMode: analysis.mode,
        interpretedIntent: extended.intent,
        confidence: extended.confidence,
        matchedExampleIds: extended.recordIds,
        matchedTerms: extended.evidence,
        selectedStructure: extended.structureId,
        source: "extended-pack",
      },
    };
  }

  if (hasUnresolvedReference(input)) {
    const analysis = analyseSentence(input);
    return {
      text: "I cannot resolve that reference to exactly one supported subject or pair. Name one subject, or compare exactly two subjects, then ask the question again.",
      trace: {
        normalizedInput: analysis.normalized,
        sentenceMode: analysis.mode,
        interpretedIntent: "reference-clarification",
        confidence: 1,
        matchedExampleIds: ["grammar:unresolved-reference"],
        matchedTerms: ["unresolved reference", "subject required"],
        selectedStructure: "reference-clarification",
        source: "safe-fallback",
      },
    };
  }

  const { analysis, matches } = searchContexts(input, entries);
  const decision = determineContext(analysis, matches);
  const connected = connectWords(analysis, decision, entries);
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

function dictionaryReply(input: string, term: string, word: string, wordsetId: string, definition: string, partOfSpeech?: string): LexiReply {
  const analysis = analyseSentence(input);
  const label = word ? word[0].toLocaleUpperCase("en-US") + word.slice(1) : term;
  const cleanedDefinition = definition.trim().replace(/[.!?]+$/, "");
  const qualifier = partOfSpeech ? ` (${partOfSpeech})` : "";

  return {
    text: `${label} means ${cleanedDefinition}${qualifier}.`,
    trace: {
      normalizedInput: analysis.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent: "definition",
      confidence: 1,
      matchedExampleIds: [`wordset:${wordsetId}`],
      matchedTerms: [term, partOfSpeech].filter((value): value is string => Boolean(value)),
      selectedStructure: "definition-full-wordset",
      source: "full-dictionary",
    },
  };
}

async function respondToClauseAsync(
  input: string,
  dictionaryOptions: DictionaryLookupOptions,
): Promise<LexiReply> {
  const ordinaryReply = respondToClause(input);
  if (
    ordinaryReply.trace.source === "core-phrase" ||
    ordinaryReply.trace.source === "extended-pack"
  ) {
    return ordinaryReply;
  }

  const term = extractDefinitionTerm(input);
  if (!term) return ordinaryReply;

  const entry = await findWordsetEntry(term, dictionaryOptions);
  const meaning = entry?.meanings.find((candidate) => candidate.def.trim());
  if (!entry || !meaning) return ordinaryReply;

  return dictionaryReply(
    input,
    term,
    entry.word,
    entry.wordset_id,
    meaning.def,
    meaning.speech_part,
  );
}

export function respond(input: string): LexiReply {
  const clauses = splitIntoClauses(input);
  if (clauses.length > 1) {
    return combineClauseReplies(input, clauses.map(respondToClause));
  }

  return respondToClause(input);
}

export async function respondAsync(
  input: string,
  dictionaryOptions: DictionaryLookupOptions = {},
): Promise<LexiReply> {
  const clauses = splitIntoClauses(input);
  const replies = await Promise.all(
    clauses.map((clause) => respondToClauseAsync(clause, dictionaryOptions)),
  );

  if (replies.length > 1) return combineClauseReplies(input, replies);
  return replies[0] ?? respondToClause(input);
}

export function corpusStats() {
  const extended = extendedPackStats();
  return {
    pages: contextPages.length,
    examples: entries.length,
    sentences: entries.length * 2,
    basicPhrasePatterns: basicPhrasePatternCount,
    extendedTopics: extended.topics,
    extendedAliases: extended.aliases,
    extendedQuestionFrames: extended.questionFrames,
    extendedConstructions: extended.minimumQuestionConstructions,
    linguisticFeatures:
      extended.linguisticFeatures + discourseReferenceFeatureCount,
  };
}
