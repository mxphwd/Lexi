import { extendedConversationPatternCount } from "./conversation";
import {
  linguisticRewriteFeatureCount,
  prepareDiscourseInput,
  prepareLinguisticInput,
} from "./linguistic-features";
import { extendedQuestionFrameCount } from "./question-frames";
import { extendedAliasCount, matchExtendedPack } from "./router";
import { knowledgeTopics } from "./topics";

export { matchExtendedPack, prepareDiscourseInput, prepareLinguisticInput };
export type { KnowledgeTopic, PackFocus, PackResponse } from "./types";

export function extendedPackStats() {
  return {
    topics: knowledgeTopics.length,
    aliases: extendedAliasCount,
    questionFrames: extendedQuestionFrameCount,
    conversationPatterns: extendedConversationPatternCount,
    linguisticFeatures:
      extendedQuestionFrameCount +
      linguisticRewriteFeatureCount +
      extendedConversationPatternCount,
    rewriteFeatures: linguisticRewriteFeatureCount,
    minimumQuestionConstructions:
      extendedAliasCount * extendedQuestionFrameCount +
      extendedConversationPatternCount,
  };
}
