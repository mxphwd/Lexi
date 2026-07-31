import { analyseSentence } from "@/modules/search";
import {
  answerKnowledgeQuery,
  lexiKnowledgeGraph,
} from "@/modules/knowledge-graph";
import { realizeGraphAnswer } from "@/modules/proposition";
import { parseSemanticQuery } from "@/modules/semantic";
import type { LexiReply } from "@/lib/lexi/types";

export type Dv7KnowledgeContext = {
  activeSubjectIds?: readonly string[];
};

export function matchDv7Knowledge(
  input: string,
  context: Dv7KnowledgeContext = {},
): LexiReply | undefined {
  const query = parseSemanticQuery(input, lexiKnowledgeGraph, context);
  if (
    !query.subjectId ||
    query.kind === "unknown" ||
    query.kind === "memory" ||
    query.kind === "statement"
  ) {
    return undefined;
  }

  const answer = answerKnowledgeQuery(lexiKnowledgeGraph, query);
  if (!answer) return undefined;
  if (
    query.kind === "open" &&
    query.relation === "definition" &&
    query.subjectId
  ) {
    const adjunctRelations =
      query.modifiers.style === "exampled" ||
      query.modifiers.style === "practical" ||
      query.modifiers.style === "analogy"
        ? (["example"] as const)
        : query.modifiers.style === "detailed" ||
            query.modifiers.style === "balanced"
          ? (["purpose", "mechanism", "importance"] as const)
          : [];
    for (const relation of adjunctRelations) {
      const adjunct = answerKnowledgeQuery(lexiKnowledgeGraph, {
        ...query,
        relation,
        property: relation,
      });
      if (!adjunct) continue;
      answer.propositions.push(...adjunct.propositions);
      answer.proof.push(...adjunct.proof);
    }
  }
  const realized = realizeGraphAnswer(lexiKnowledgeGraph, query, answer);
  const analysis = analyseSentence(input);
  const subjectIds = [
    query.subjectId,
    ...(query.objectId ? [query.objectId] : []),
  ];

  return {
    text: realized.text,
    trace: {
      normalizedInput: analysis.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent:
        query.kind === "comparison"
          ? "comparison"
          : answer.relation === "has_part" || answer.relation === "component"
            ? "components"
            : answer.relation === "related_to"
              ? "related"
              : answer.relation === "function"
                ? "purpose"
              : answer.relation ?? query.relation,
      confidence: answer.confidence,
      matchedExampleIds: answer.propositions.map(
        (proposition) => `proposition:${proposition.id}`,
      ),
      matchedTerms: [...new Set([...query.evidence, ...realized.evidence])],
      selectedStructure: realized.structureId,
      source: "knowledge-graph",
      subjectIds,
      proof: answer.proof.map((step) => step.explanation),
    },
  };
}
