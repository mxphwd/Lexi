import type { LexiReply } from "@/lib/lexi/types";
import { Dv9DialogueState } from "./dialogue";
import { findDv9Entry } from "./loader";
import { parseDv9LexicalPlan } from "./parser";
import { realizeDv9Lexical } from "./realizer";
import { dv9DataManifest, validateDv9Manifest } from "./schema";
import type { Dv9LexicalPlan, Dv9LoaderOptions } from "./types";

export { Dv9DialogueState } from "./dialogue";
export { Dv9ShardLoadError, dv9ShardCacheStats, findDv9Entry, loadDv9Shard, dv9ShardFor } from "./loader";
export { parseDv9LexicalPlan } from "./parser";
export { dv9LexicalLookupForms, dv9NormalizeLexical } from "./normalize";
export { dv9DataManifest, validateDv9Manifest } from "./schema";
export type * from "./types";

export type Dv9Match = {
  reply: LexiReply;
  plan: Dv9LexicalPlan;
};

export async function matchDv9Data(
  input: string,
  options: Dv9LoaderOptions = {},
  dialogue?: Dv9DialogueState,
): Promise<Dv9Match | undefined> {
  const plan = parseDv9LexicalPlan(input, dialogue?.snapshot());
  if (!plan) return undefined;
  const entry = await findDv9Entry(plan.term, options);
  if (!entry) return undefined;
  const realized = realizeDv9Lexical(input, plan, entry);
  dialogue?.record(plan);
  dialogue?.recordSense(realized.senseIndex);
  return { plan, reply: realized.reply };
}

export function dv9EngineStats() {
  const validation = validateDv9Manifest();
  return {
    build: dv9DataManifest.build,
    valid: validation.valid,
    validationErrors: validation.errors,
    ...dv9DataManifest.counts,
  };
}
