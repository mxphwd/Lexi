import { lexiKnowledgeGraph, predicateDefinitions } from "@/modules/knowledge-graph";
import {
  semanticAnswerStyles,
  semanticBooleanQuestionTemplates,
  semanticComparisonQuestionTemplates,
  semanticOpenQuestionTemplates,
} from "@/modules/semantic";

export const DV6_DIRECT_CONSTRUCTIONS = 500_347;

export function dv7AvailabilityStats() {
  const benchmarkable = new Set(
    predicateDefinitions
      .filter((predicate) => predicate.benchmarkable)
      .map((predicate) => predicate.id),
  );
  const propositions = lexiKnowledgeGraph
    .allPropositions()
    .filter((proposition) => benchmarkable.has(proposition.predicate));
  const subjectsByPredicate = new Map<string, Set<string>>();

  for (const proposition of propositions) {
    const subjects = subjectsByPredicate.get(proposition.predicate) ?? new Set();
    subjects.add(proposition.subjectId);
    subjectsByPredicate.set(proposition.predicate, subjects);
  }

  const comparableSubjectPairs = [...subjectsByPredicate.values()].reduce(
    (sum, subjects) => sum + (subjects.size * (subjects.size - 1)) / 2,
    0,
  );
  const directOpenConstructions =
    propositions.length *
    semanticOpenQuestionTemplates.length *
    semanticAnswerStyles.length;
  const booleanConstructions =
    propositions.length *
    semanticBooleanQuestionTemplates.length *
    semanticAnswerStyles.length;
  const comparisonConstructions =
    comparableSubjectPairs *
    semanticComparisonQuestionTemplates.length *
    semanticAnswerStyles.length;
  const semanticConstructions =
    directOpenConstructions +
    booleanConstructions +
    comparisonConstructions;

  return {
    ...lexiKnowledgeGraph.stats(),
    benchmarkablePropositions: propositions.length,
    predicates: subjectsByPredicate.size,
    openQuestionFrames: semanticOpenQuestionTemplates.length,
    booleanQuestionFrames: semanticBooleanQuestionTemplates.length,
    comparisonQuestionFrames: semanticComparisonQuestionTemplates.length,
    answerStyles: semanticAnswerStyles.length,
    comparableSubjectPairs,
    directOpenConstructions,
    booleanConstructions,
    comparisonConstructions,
    semanticConstructions,
    multipleOverDv6: semanticConstructions / DV6_DIRECT_CONSTRUCTIONS,
  };
}

