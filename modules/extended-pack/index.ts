import { extendedConversationPatternCount } from "./conversation";
import {
  extendedAliasCount,
  extendedQuestionFrameCount,
  matchExtendedPack,
} from "./router";
import { knowledgeTopics } from "./topics";

export { matchExtendedPack };
export type { KnowledgeTopic, PackFocus, PackResponse } from "./types";

export function extendedPackStats() {
  return {
    topics: knowledgeTopics.length,
    aliases: extendedAliasCount,
    questionFrames: extendedQuestionFrameCount,
    conversationPatterns: extendedConversationPatternCount,
    minimumQuestionConstructions:
      extendedAliasCount * extendedQuestionFrameCount +
      extendedConversationPatternCount,
  };
}
