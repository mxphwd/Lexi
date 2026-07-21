import type { ContextDecision } from "@/lib/lexi/types";
import type { ConnectedWords } from "@/modules/connect";
import { structures } from "./patterns";

function sentenceCase(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function realiseSentence(
  decision: ContextDecision,
  connected: ConnectedWords,
): { text: string; structureId: string } {
  const structure =
    structures.find((pattern) => pattern.intent === decision.intent) ??
    structures.find((pattern) => pattern.intent === "unknown")!;

  if (structure.template === "{response}" && connected.sourceEntry) {
    return { text: connected.sourceEntry.response, structureId: structure.id };
  }

  const qualifier = connected.qualifier ? ` ${connected.qualifier}` : "";
  const text = structure.template
    .replace("{subject}", connected.subject)
    .replace("{action}", connected.action)
    .replace("{object}", connected.object)
    .replace("{qualifier}", qualifier)
    .replace(/\s+([.,!?])/g, "$1");

  return { text: sentenceCase(text), structureId: structure.id };
}

export { realiseCombinedResponses } from "./combine";
