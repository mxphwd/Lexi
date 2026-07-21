import type { LexiReply, SentenceMode } from "@/lib/lexi/types";
import { realiseCombinedResponses } from "@/modules/structure";
import { normalizeText } from "@/modules/search/tokenize";

function uniqueValues(values: string[], limit: number): string[] {
  return [...new Set(values.filter(Boolean))].slice(0, limit);
}

function combinedMode(replies: LexiReply[]): SentenceMode {
  const modes = new Set(replies.map((reply) => reply.trace.sentenceMode));
  if (modes.has("interrogative")) return "interrogative";
  if (modes.has("imperative")) return "imperative";
  if (modes.has("exclamative")) return "exclamative";
  return "declarative";
}

export function combineClauseReplies(input: string, replies: LexiReply[]): LexiReply {
  const uniqueReplies = replies.filter(
    (reply, index) => replies.findIndex((candidate) => candidate.text === reply.text) === index,
  );

  if (uniqueReplies.length === 1) return uniqueReplies[0];

  const realised = realiseCombinedResponses(uniqueReplies);
  const clauseIntents = uniqueReplies.map((reply) => reply.trace.interpretedIntent);
  const averageConfidence =
    uniqueReplies.reduce((sum, reply) => sum + reply.trace.confidence, 0) / uniqueReplies.length;

  return {
    text: realised.text,
    trace: {
      normalizedInput: normalizeText(input),
      sentenceMode: combinedMode(uniqueReplies),
      interpretedIntent: uniqueValues(clauseIntents, 4).join(" + "),
      confidence: Number(averageConfidence.toFixed(2)),
      matchedExampleIds: uniqueValues(
        uniqueReplies.flatMap((reply) => reply.trace.matchedExampleIds),
        9,
      ),
      matchedTerms: uniqueValues(
        uniqueReplies.flatMap((reply) => reply.trace.matchedTerms),
        12,
      ),
      selectedStructure: realised.structureId,
      source: "combined-response",
      clauseCount: uniqueReplies.length,
      clauseIntents,
    },
  };
}
