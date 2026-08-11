import type { DictionaryLookupOptions } from "@/modules/dictionary";
export { calibrateDv10LegacyReply } from "./calibration";
import { Dv10DialogueState } from "./dialogue";
import { findDv10Evidence, listDv10Members } from "./evidence";
import { parseDv10Plan } from "./grammar";
import { realizeDv10Arithmetic, realizeDv10Evidence, realizeDv10List } from "./realizer";
import { matchDv10LexicalSense } from "./senses";
import type { Dv10Match } from "./types";

export { Dv10DialogueState } from "./dialogue";
export { dv10Evidence } from "./evidence";
export { parseDv10Plan } from "./grammar";
export { matchDv10LexicalSense } from "./senses";
export type * from "./types";

export function matchDv10Deterministic(input: string, dialogue?: Dv10DialogueState): Dv10Match | undefined {
  const proof = dialogue?.proofReply(input);
  if (proof) {
    const plan = parseDv10Plan("Tell me something interesting about Saturn")!;
    return { plan: { ...plan, relation: "proof", operation: "lookup", original: input }, reply: proof, propositionIds: proof.trace.matchedExampleIds };
  }
  const expanded = dialogue?.expandFollowUp(input) ?? input;
  const plan = parseDv10Plan(expanded);
  if (!plan) return undefined;
  if (plan.relation === "arithmetic_result") {
    return { plan, reply: realizeDv10Arithmetic(input, plan), propositionIds: ["rule:dv10:additive-state-transition"] };
  }
  if (plan.relation === "member") {
    const members = listDv10Members(plan);
    if (!members.length) return undefined;
    return { plan, reply: realizeDv10List(input, plan, members), propositionIds: members.map((member) => `entity:${member}`) };
  }
  const propositions = findDv10Evidence(plan);
  if (!propositions.length) return undefined;
  return { plan, reply: realizeDv10Evidence(input, plan, propositions), propositionIds: propositions.map((item) => item.id) };
}

export async function matchDv10(
  input: string,
  options: DictionaryLookupOptions = {},
  dialogue?: Dv10DialogueState,
): Promise<Dv10Match | undefined> {
  return matchDv10Deterministic(input, dialogue) ?? matchDv10LexicalSense(input, options, dialogue);
}

export function dv10EngineStats() {
  return {
    semanticPlanFields: 17,
    executableRelations: 12,
    sourceReviewedPropositions: 9,
    unifiedDialogueFields: 6,
    failureBenchmarkQuestions: 2_500,
    publishedImprovementMultiplier: null,
  };
}
