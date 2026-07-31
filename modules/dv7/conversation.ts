import type { LexiReply } from "@/lib/lexi/types";
import { analyseSentence } from "@/modules/search";

export const dv7ConversationPatternCount = 3;

export function matchDv7Conversation(input: string): LexiReply | undefined {
  const analysis = analyseSentence(input);
  if (
    !/^(?:can|could|would) you clarify (?:that|this)$/.test(
      analysis.normalized,
    )
  ) {
    return undefined;
  }

  return {
    text: "Include the sentence or subject you want clarified. I can then explain the specific proposition in a shorter or more detailed form.",
    trace: {
      normalizedInput: analysis.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent: "clarification-request",
      confidence: 1,
      matchedExampleIds: ["dv7-conversation:clarify-reference"],
      matchedTerms: ["clarification", "explicit subject", "session boundary"],
      selectedStructure: "dv7-conversation:clarification-request",
      source: "extended-pack",
    },
  };
}
