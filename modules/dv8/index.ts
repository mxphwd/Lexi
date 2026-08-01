import type { LexiReply } from "@/lib/lexi/types";
import { lexiKnowledgeGraph } from "@/modules/knowledge-graph";
import { analyseSentence } from "@/modules/search";
import { executeQueryPlan } from "./executor";
import { Dv8FactStore } from "./facts";
import { CompiledLexicalIndex } from "./lexicon";
import { parseQueryPlan, type Dv8ParseContext } from "./parser";
import { realizeExecution } from "./realizer";
import { executeTask } from "./tasks";
import type { QueryPlan } from "./types";

export { Dv8DialogueState } from "./dialogue";
export { executeQueryPlan } from "./executor";
export { Dv8FactStore } from "./facts";
export { CompiledLexicalIndex } from "./lexicon";
export { parseQueryPlan } from "./parser";
export type * from "./types";

export const dv8LexicalIndex = new CompiledLexicalIndex(lexiKnowledgeGraph);
export const dv8FactStore = new Dv8FactStore(lexiKnowledgeGraph);

export type Dv8Match = {
  reply: LexiReply;
  plan: QueryPlan;
};

function replyFor(
  input: string,
  plan: QueryPlan,
  text: string,
  sourceIds: string[],
  proof: string[],
  confidence: number,
): LexiReply {
  const analysis = analyseSentence(input);
  const relation = plan.patterns[0]?.predicate;
  const interpretedIntent = plan.operation === "transform"
    ? `transform:${plan.transform?.task}`
    : plan.operation === "clarify"
      ? "typed-clarification"
      : plan.operation === "compare"
        ? "comparison"
        : relation === "has_part" || relation === "component"
          ? "components"
          : relation === "related_to"
            ? "related"
            : relation === "function"
              ? "purpose"
              : relation ?? plan.operation;
  return {
    text,
    trace: {
      normalizedInput: analysis.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent,
      confidence,
      matchedExampleIds: sourceIds,
      matchedTerms: plan.evidence,
      selectedStructure: `dv8-language-engine:${plan.operation}:${plan.patterns[0]?.predicate ?? plan.transform?.task ?? "clarify"}:${plan.style ?? "plain"}`,
      source: "language-engine",
      subjectIds: plan.subjectIds,
      proof,
    },
  };
}

export function matchDv8(
  input: string,
  context: Dv8ParseContext = {},
): Dv8Match | undefined {
  if (/^(?:how (?:do|can) i get to|give me directions|which way (?:is|to))\b/i.test(input.trim())) {
    return undefined;
  }
  const plan = parseQueryPlan(input, dv8LexicalIndex, context);
  if (plan.operation === "transform") {
    const task = executeTask(plan);
    if (!task) return undefined;
    return {
      plan,
      reply: replyFor(input, plan, task.text, task.evidence, task.evidence, plan.confidence),
    };
  }
  if (plan.operation === "clarify") {
    if (plan.confidence === 0) return undefined;
    const term = plan.unresolvedTerms[0];
    const ambiguousSenses = plan.evidence.filter((item) => item.startsWith("sense:"));
    const text = ambiguousSenses.length
      ? `“${term}” has more than one recorded meaning here. Add a type or subject—for example, a person, place, or unit—so I can choose one explicitly.`
      : `I recognize ${plan.subjectIds.length ? "the subject" : "part of the request"}, but “${term ?? "that property"}” does not map to a supported typed relation. Name the exact property you want.`;
    return {
      plan,
      reply: replyFor(input, plan, text, ambiguousSenses, ["Abstained before unrelated fallback routing."], 1),
    };
  }
  const result = executeQueryPlan(plan, dv8FactStore);
  const text = realizeExecution(plan, result, dv8FactStore);
  return {
    plan,
    reply: replyFor(
      input,
      plan,
      text,
      result.facts.map((fact) => `fact:${fact.id}`),
      result.proof.map((proof) => proof.explanation),
      result.confidence,
    ),
  };
}

export function matchDv8Task(input: string): Dv8Match | undefined {
  const plan = parseQueryPlan(input, dv8LexicalIndex);
  if (plan.operation !== "transform") return undefined;
  const task = executeTask(plan);
  if (!task) return undefined;
  return {
    plan,
    reply: replyFor(input, plan, task.text, task.evidence, task.evidence, plan.confidence),
  };
}

export function dv8EngineStats() {
  return {
    lexicon: dv8LexicalIndex.stats(),
    facts: dv8FactStore.stats(),
    operations: 7,
    filterTypes: 5,
    explicitRuleFamilies: 10,
  };
}
