import type { Dv9RuntimeEntry } from "@/modules/dv9";
import { dv11NormalizeText, stableHash } from "./normalize";
import { dv11PackageContentHash, type Dv11KnowledgeStore } from "./store";
import type { Dv11Entity, Dv11KnowledgePackage, Dv11Proposition, Dv11SenseCandidate } from "./types";

export function installDv9LexicalEntry(store: Dv11KnowledgeStore, entry: Dv9RuntimeEntry) {
  const packageId = `alphaine.lexi.dv9.lexical.${stableHash(`${entry.i ?? "entry"}:${entry.w}`)}`;
  if (store.manifests().some((manifest) => manifest.packageId === packageId)) return false;
  const entities: Dv11Entity[] = [];
  const senses: Dv11SenseCandidate[] = [];
  const propositions: Dv11Proposition[] = [];
  for (const [senseId, partOfSpeech, definition, example] of entry.m) {
    const entityId = `dv9:${senseId}`;
    const normalizedSenseId = `dv9-sense:${senseId}`;
    entities.push({ id: entityId, canonicalName: entry.w, kind: "concept", aliases: [dv11NormalizeText(entry.w)], senseIds: [normalizedSenseId] });
    senses.push({ senseId: normalizedSenseId, entityId, lemma: entry.w, partOfSpeech, domains: [], definition, usages: example ? [example] : [], contextualFeatures: [...new Set([partOfSpeech, ...(example?.match(/[\p{L}\p{M}]{4,}/gu) ?? [])])].slice(0, 12), score: 0.82, evidence: [`dv9:${entry.i ?? senseId}`] });
    propositions.push({
      id: `dv9-proposition:${senseId}:definition`, subjectId: entityId, relation: "definition", object: { kind: "text", value: definition }, qualifiers: { scope: partOfSpeech },
      provenance: [{ sourceId: "wordset-dictionary", sourceLocation: `dv9:${entry.i ?? senseId}`, extractionMethod: "imported", reviewStatus: "source-attested", confidence: 0.9, createdAt: "2026-08-02", license: "CC-BY-SA-4.0", disputeStatus: "undisputed" }], polarity: "positive",
    });
    if (example) propositions.push({
      id: `dv9-proposition:${senseId}:example`, subjectId: entityId, relation: "example", object: { kind: "text", value: example }, qualifiers: { scope: partOfSpeech },
      provenance: [{ sourceId: "wordset-dictionary", sourceLocation: `dv9:${entry.i ?? senseId}`, extractionMethod: "imported", reviewStatus: "source-attested", confidence: 0.85, createdAt: "2026-08-02", license: "CC-BY-SA-4.0", disputeStatus: "undisputed" }], polarity: "positive",
    });
  }
  const contents = { entities, propositions, schemas: [], senses };
  const pack: Dv11KnowledgePackage = {
    manifest: { schemaVersion: 1, packageId, version: "9.0.0-import", minimumRuntime: "DV11", contentHash: dv11PackageContentHash(contents), generatedAt: "2026-08-12", dependencies: [], counts: { entities: entities.length, propositions: propositions.length, senses: senses.length, schemas: 0, rules: 0 }, capabilities: ["on-demand-lexical-propositions", "explicit-word-senses"] },
    ...contents,
  };
  store.addPackage(pack);
  return true;
}
