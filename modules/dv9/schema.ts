import manifestJson from "@/data/dv9/manifest.json";
import type {
  Dv9DataManifest,
  Dv9Provenance,
  Dv9RuntimeEntry,
} from "./types";

export const dv9DataManifest = manifestJson as Dv9DataManifest;

export function validateDv9Manifest(manifest: Dv9DataManifest = dv9DataManifest) {
  const errors: string[] = [];
  const { counts, targets } = manifest;
  if (manifest.schemaVersion !== 1) errors.push("Unsupported manifest schema.");
  if (counts.validatedAtomicFacts !== targets.validatedAtomicFacts) errors.push("Atomic-fact target mismatch.");
  if (counts.entities < targets.entityMinimum || counts.entities > targets.entityMaximum) errors.push("Entity target mismatch.");
  if (counts.typedRelationProfiles !== targets.typedRelationProfiles) errors.push("Relation-profile target mismatch.");
  if (
    counts.explicitLexicalSenses < targets.explicitLexicalSensesMinimum ||
    counts.explicitLexicalSenses > targets.explicitLexicalSensesMaximum
  ) errors.push("Lexical-sense target mismatch.");
  if (counts.queryPlanExamples < targets.queryPlanExamples) errors.push("Query-plan target mismatch.");
  if (counts.inferenceRules < targets.inferenceRules) errors.push("Inference-rule target mismatch.");
  if (counts.dialogueScenarios < targets.dialogueScenarios) errors.push("Dialogue target mismatch.");
  if (counts.heldOutBlindQuestions < targets.heldOutBlindQuestions) errors.push("Blind-question target mismatch.");
  if (counts.sourceAttestedFacts + counts.mechanicallyDerivedFacts !== counts.validatedAtomicFacts) {
    errors.push("Fact-review classes do not reconcile to the atomic-fact total.");
  }
  return { valid: errors.length === 0, errors };
}

export function validDv9Provenance(value: Dv9Provenance) {
  return Boolean(
    value.sourceId &&
    value.evidence.trim() &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    (!value.validFrom || !value.validTo || value.validFrom <= value.validTo),
  );
}

export function isDv9RuntimeEntry(value: unknown): value is Dv9RuntimeEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<Dv9RuntimeEntry>;
  return Boolean(
    typeof entry.e === "string" &&
    typeof entry.w === "string" &&
    (typeof entry.i === "string" || entry.i === null) &&
    Array.isArray(entry.m) &&
    entry.m.every((meaning) =>
      Array.isArray(meaning) &&
      meaning.length === 4 &&
      meaning.every((item, index) => index === 3 ? item === null || typeof item === "string" : typeof item === "string"),
    ) &&
    Array.isArray(entry.r) &&
    entry.r.every((item) => typeof item === "string"),
  );
}
