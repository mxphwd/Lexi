import { extendedConversationPatternCount } from "./conversation";
import {
  linguisticRewriteFeatureCount,
  prepareDiscourseInput,
  prepareLinguisticInput,
} from "./linguistic-features";
import { extendedQuestionFrameCount } from "./question-frames";
import { deterministicReasoningFeatureCount } from "./reasoning";
import { semanticRoutingFeatureCount } from "./semantic-routing";
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
      extendedConversationPatternCount +
      deterministicReasoningFeatureCount +
      semanticRoutingFeatureCount,
    rewriteFeatures: linguisticRewriteFeatureCount,
    reasoningFeatures: deterministicReasoningFeatureCount,
    semanticRoutingFeatures: semanticRoutingFeatureCount,
    minimumQuestionConstructions:
      extendedAliasCount * extendedQuestionFrameCount +
      extendedConversationPatternCount +
      deterministicReasoningFeatureCount,
  };
}
