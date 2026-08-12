export { calibrateDv11Clause, calibrateDv11Result, dv11ReliabilityBuckets, registerDv11CalibrationProfile } from "./calibration";
export { Dv11DialogueState } from "./dialogue";
export { executeDv11Plan } from "./executor";
export { installDv9LexicalEntry } from "./lexical";
export { dv11NormalizeText, dv11Number, dv11Tokens, normalizeDv11Request, splitDv11Clauses, stableHash } from "./normalize";
export { dv11ParserStats, parseDv11Query, registerDv11ParserPlugin } from "./parser";
export { Dv11PackageRegistry } from "./packages";
export type { Dv11PackageDescriptor, Dv11PackageLoadResult } from "./packages";
export { realizeDv11Result } from "./realizer";
export { compiledDv11Rules, dv11Rule, dv11RuleStats } from "./rules";
export type { Dv11CompiledRule, Dv11RuleFamily, Dv11RuleType } from "./rules";
export { dv11PredicateSchema, dv11PredicateSchemas, normalizeDv11Quantity, registerDv11PredicateSchema } from "./schema";
export { createDv11KnowledgeStore, dv11KnowledgeStore, dv11PackageContentHash, Dv11KnowledgeStore, validateDv11Package } from "./store";
export { Dv11RuntimeSession } from "./runtime";
export type * from "./types";

import { dv11ParserStats } from "./parser";
import { dv11PredicateSchemas } from "./schema";
import { dv11RuleStats } from "./rules";
import { dv11KnowledgeStore } from "./store";

export function dv11EngineStats() {
  return {
    build: "260812-DV11",
    architecture: "unified-typed-semantic-runtime",
    parser: dv11ParserStats(),
    store: dv11KnowledgeStore.stats(),
    predicateSchemas: dv11PredicateSchemas.size,
    rules: dv11RuleStats(),
    executionStatuses: 8,
    publishedImprovementMultiplier: null,
  };
}
