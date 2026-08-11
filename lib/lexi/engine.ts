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
import {
  dv7AvailabilityStats,
  matchDv7Conversation,
  matchDv7Knowledge,
} from "@/modules/dv7";
import {
  Dv8DialogueState,
  dv8EngineStats,
  matchDv8,
  matchDv8Task,
  type QueryPlan,
} from "@/modules/dv8";
import {
  Dv9DialogueState,
  dv9EngineStats,
  matchDv9Data,
  parseDv9LexicalPlan,
} from "@/modules/dv9";
import {
  Dv10DialogueState,
  calibrateDv10LegacyReply,
  dv10EngineStats,
  matchDv10,
  matchDv10Deterministic,
} from "@/modules/dv10";
import { lexiKnowledgeGraph } from "@/modules/knowledge-graph";
import { LexiSessionMemory } from "@/modules/memory";
import { analyseSentence, searchContexts } from "@/modules/search";
import { realiseSentence } from "@/modules/structure";
import type { ContextEntry, LexiReply } from "./types";

const entries: ContextEntry[] = contextPages.flatMap((page) => page.entries);

type EngineState = {
  activeSubjectIds: string[];
  memory?: LexiSessionMemory;
  dialogue?: Dv8DialogueState;
  dv9Dialogue?: Dv9DialogueState;
  dv10Dialogue?: Dv10DialogueState;
  lastPlan?: QueryPlan;
};

function memoryReply(input: string, state?: EngineState): LexiReply | undefined {
  const recalled = state?.memory?.interpret(input);
  if (!recalled) return undefined;
  const analysis = analyseSentence(input);
  return {
    text: recalled.text,
    trace: {
      normalizedInput: analysis.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent: recalled.intent,
      confidence: 1,
      matchedExampleIds: [recalled.evidence[0]],
      matchedTerms: recalled.evidence,
      selectedStructure: recalled.structureId,
      source: "session-memory",
      subjectIds: [...(state?.activeSubjectIds ?? [])],
      proof: [`Used the explicit ${recalled.field} value stored in this session.`],
    },
  };
}

function respondToClauseCore(
  input: string,
  state?: EngineState,
  options: { dv8: boolean } = { dv8: true },
): LexiReply {
  const remembered = memoryReply(input, state);
  if (remembered) return remembered;

  if (options.dv8) {
    const dialogue = state?.dialogue?.interpret(input, lexiKnowledgeGraph);
    if (dialogue) return dialogue;
    const dv8Task = matchDv8Task(input);
    if (dv8Task) {
      if (state) state.lastPlan = dv8Task.plan;
      return dv8Task.reply;
    }
  }

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
  if (
    extended?.intent.startsWith("reasoning:") ||
    extended?.structureId.startsWith("extended-conversation:") ||
    extended?.intent === "summary" ||
    extended?.intent === "learning" ||
    extended?.intent === "similarity"
  ) {
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

  if (options.dv8) {
    const dv8 = matchDv8(input, {
      activeSubjectIds:
        state?.dialogue?.activeSubjectIds().length
          ? state.dialogue.activeSubjectIds()
          : state?.activeSubjectIds,
    });
    if (dv8) {
      if (state) state.lastPlan = dv8.plan;
      return dv8.reply;
    }
  }

  const semantic = matchDv7Knowledge(input, {
    activeSubjectIds: state?.activeSubjectIds,
  });
  if (semantic) return semantic;

  const dv7Conversation = matchDv7Conversation(input);
  if (dv7Conversation) return dv7Conversation;

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

function updateEngineState(
  input: string,
  reply: LexiReply,
  state: EngineState,
) {
  const subjectIds =
    reply.trace.subjectIds?.length
      ? reply.trace.subjectIds
      : lexiKnowledgeGraph.findMentions(input).map((mention) => mention.entityId);
  if (subjectIds.length > 0) {
    state.activeSubjectIds = [...new Set(subjectIds)].slice(0, 2);
    state.memory?.setActiveSubjects(state.activeSubjectIds);
  }
}

function respondToClause(input: string, state: EngineState): LexiReply {
  const reply = respondToClauseCore(input, state);
  updateEngineState(input, reply, state);
  return reply;
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
  state: EngineState,
): Promise<LexiReply> {
  const dv9Conversation = state.dv9Dialogue?.interpret(input);
  if (dv9Conversation) return dv9Conversation;

  const lexicalPlan = parseDv9LexicalPlan(input, state.dv9Dialogue?.snapshot());
  const preferLexicalData = Boolean(
    lexicalPlan && (
      lexicalPlan.operation !== "define" ||
      lexicalPlan.contextHint ||
      /\b(?:word|term|mean|meaning|dictionary|lexicon)\b/i.test(input)
    ),
  );
  if (preferLexicalData) {
    const dv9 = await matchDv9Data(input, dictionaryOptions, state.dv9Dialogue).catch(() => undefined);
    if (dv9) return dv9.reply;
  }

  const ordinaryReply = respondToClause(input, state);
  if (
    ordinaryReply.trace.source === "core-phrase" ||
    ordinaryReply.trace.source === "knowledge-graph" ||
    ordinaryReply.trace.source === "language-engine" ||
    ordinaryReply.trace.source === "session-memory" ||
    ordinaryReply.trace.source === "dv9-data-engine"
  ) {
    return ordinaryReply;
  }

  const dv9 = preferLexicalData
    ? undefined
    : await matchDv9Data(input, dictionaryOptions, state.dv9Dialogue).catch(() => undefined);
  if (dv9) return dv9.reply;

  if (ordinaryReply.trace.source === "extended-pack") return ordinaryReply;

  const term = extractDefinitionTerm(input);
  if (!term) return ordinaryReply;

  const entry = await findWordsetEntry(term, dictionaryOptions);
  const meaning = entry?.meanings.find((candidate) => candidate.def.trim());
  if (!entry || !meaning) return ordinaryReply;

  const reply = dictionaryReply(
    input,
    term,
    entry.word,
    entry.wordset_id,
    meaning.def,
    meaning.speech_part,
  );
  updateEngineState(input, reply, state);
  return reply;
}

export function respond(input: string): LexiReply {
  const state: EngineState = { activeSubjectIds: [] };
  return respondWithState(input, state);
}

function respondWithState(
  input: string,
  state: EngineState,
  options: { dv8: boolean } = { dv8: true },
): LexiReply {
  state.lastPlan = undefined;
  const dv10 = options.dv8
    ? matchDv10Deterministic(input, state.dv10Dialogue)
    : undefined;
  if (dv10) {
    updateEngineState(input, dv10.reply, state);
    return dv10.reply;
  }
  const clauses = splitIntoClauses(input);
  if (clauses.length > 1) {
    return combineClauseReplies(
      input,
      clauses.map((clause) => {
        const reply = calibrateDv10LegacyReply(clause, respondToClauseCore(clause, state, options));
        updateEngineState(clause, reply, state);
        return reply;
      }),
    );
  }

  const reply = calibrateDv10LegacyReply(input, respondToClauseCore(input, state, options));
  updateEngineState(input, reply, state);
  return reply;
}

/** Frozen DV7 routing path used only to measure DV8 against the same blind set. */
export function respondDv7Baseline(input: string): LexiReply {
  return respondWithState(input, { activeSubjectIds: [] }, { dv8: false });
}

export async function respondAsync(
  input: string,
  dictionaryOptions: DictionaryLookupOptions = {},
): Promise<LexiReply> {
  const state: EngineState = { activeSubjectIds: [] };
  return respondAsyncWithState(input, dictionaryOptions, state);
}

async function respondAsyncWithState(
  input: string,
  dictionaryOptions: DictionaryLookupOptions,
  state: EngineState,
): Promise<LexiReply> {
  state.lastPlan = undefined;
  const dv10 = await matchDv10(input, dictionaryOptions, state.dv10Dialogue).catch(() => undefined);
  if (dv10) {
    updateEngineState(input, dv10.reply, state);
    return dv10.reply;
  }
  const clauses = splitIntoClauses(input);
  const replies: LexiReply[] = [];
  for (const clause of clauses) {
    replies.push(calibrateDv10LegacyReply(clause, await respondToClauseAsync(clause, dictionaryOptions, state)));
  }

  if (replies.length > 1) return combineClauseReplies(input, replies);
  return replies[0] ?? respondToClause(input, state);
}

export class LexiSession {
  private readonly memory = new LexiSessionMemory();
  private readonly dialogue = new Dv8DialogueState();
  private readonly dv9Dialogue = new Dv9DialogueState();
  private readonly dv10Dialogue = new Dv10DialogueState();
  private readonly state: EngineState = {
    activeSubjectIds: [],
    memory: this.memory,
    dialogue: this.dialogue,
    dv9Dialogue: this.dv9Dialogue,
    dv10Dialogue: this.dv10Dialogue,
  };

  respond(input: string): LexiReply {
    const reply = respondWithState(input, this.state);
    this.memory.recordTurn(input, reply.text);
    this.dialogue.record(input, reply, this.state.lastPlan);
    this.dv10Dialogue.recordTurn(input, reply);
    return reply;
  }

  async respondAsync(
    input: string,
    dictionaryOptions: DictionaryLookupOptions = {},
  ): Promise<LexiReply> {
    const reply = await respondAsyncWithState(input, dictionaryOptions, this.state);
    this.memory.recordTurn(input, reply.text);
    this.dialogue.record(input, reply, this.state.lastPlan);
    this.dv10Dialogue.recordTurn(input, reply);
    return reply;
  }

  snapshot() {
    return {
      ...this.memory.snapshot(),
      propositions: this.dialogue.snapshot(),
      lexicalDialogue: this.dv9Dialogue.snapshot(),
      semanticDialogue: this.dv10Dialogue.snapshot(),
    };
  }
}

class Dv7BaselineSession {
  private readonly memory = new LexiSessionMemory();
  private readonly state: EngineState = {
    activeSubjectIds: [],
    memory: this.memory,
  };

  respond(input: string): LexiReply {
    const reply = respondWithState(input, this.state, { dv8: false });
    this.memory.recordTurn(input, reply.text);
    return reply;
  }
}

export function createDv7BaselineSession() {
  return new Dv7BaselineSession();
}

export function createLexiSession() {
  return new LexiSession();
}

export function corpusStats() {
  const extended = extendedPackStats();
  const dv7 = dv7AvailabilityStats();
  const dv8 = dv8EngineStats();
  const dv9 = dv9EngineStats();
  const dv10 = dv10EngineStats();
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
    knowledgeEntities: dv7.entities,
    knowledgePropositions: dv7.propositions,
    semanticConstructions: dv7.semanticConstructions,
    availabilityMultipleOverDv6: dv7.multipleOverDv6,
    dv8,
    dv9,
    dv10,
  };
}
