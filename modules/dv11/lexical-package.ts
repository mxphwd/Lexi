import type { Dv9RuntimeEntry } from "@/modules/dv9/types";
import { dv11NormalizeText, stableHash } from "./normalize";
import type { Dv11KnowledgePackage, Dv11LexicalClaim, Dv11LexicalSense, Dv11Provenance } from "./types";

function provenance(sourceLocation: string, confidence: number): Dv11Provenance[] {
  return [{ sourceId: "wordset-dictionary", sourceLocation, extractionMethod: "imported", reviewStatus: "source-attested", confidence, createdAt: "2026-08-02", license: "CC-BY-SA-4.0", disputeStatus: "undisputed" }];
}

export function dv11LexicalPackageFromEntry(entry: Dv9RuntimeEntry): Dv11KnowledgePackage {
  const packageId = `alphaine.lexi.dv9.lexical.${stableHash(`${entry.i ?? "entry"}:${entry.w}`)}`;
  const lexemeId = entry.e;
  const lexicalSenses: Dv11LexicalSense[] = [];
  const lexicalClaims: Dv11LexicalClaim[] = [];
  for (const [senseId, partOfSpeech, definition, example] of entry.m) {
    const sourceLocation = `dv9:${entry.i ?? senseId}`;
    lexicalSenses.push({ id: senseId, lexemeId, partOfSpeech, definition, example: example ?? undefined, domains: [], contextualFeatures: [...new Set([partOfSpeech, ...(example?.match(/[\p{L}\p{M}]{4,}/gu) ?? [])])].slice(0, 12), provenance: provenance(sourceLocation, 0.9) });
    lexicalClaims.push(
      { id: `lexical:${senseId}:definition`, lexemeId, senseId, relation: "definition", values: [definition], provenance: provenance(sourceLocation, 0.9) },
      { id: `lexical:${senseId}:part-of-speech`, lexemeId, senseId, relation: "part-of-speech", values: [partOfSpeech], provenance: provenance(sourceLocation, 0.95) },
    );
    if (example) lexicalClaims.push({ id: `lexical:${senseId}:usage-example`, lexemeId, senseId, relation: "usage-example", values: [example], provenance: provenance(sourceLocation, 0.85) });
  }
  if (entry.r.length) lexicalClaims.push({ id: `lexical:${lexemeId}:associations`, lexemeId, relation: "association", values: [...entry.r], provenance: [{ sourceId: "moby-thesaurus", sourceLocation: `dv9:${entry.i ?? lexemeId}`, extractionMethod: "imported", reviewStatus: "source-attested", confidence: 0.65, createdAt: "2026-08-02", license: "public-domain-moby-source", disputeStatus: "undisputed" }] });
  const contents: Omit<Dv11KnowledgePackage, "manifest"> = {
    entities: [], propositions: [], schemas: [], senses: [],
    lexemes: [{ id: lexemeId, lemma: entry.w, normalizedLemma: dv11NormalizeText(entry.w), aliases: [], senseIds: entry.m.map((meaning) => meaning[0]), packageId, sourceShard: dv11NormalizeText(entry.w)[0] ?? "_" }],
    lexicalSenses,
    lexicalClaims,
  };
  return {
    manifest: {
      schemaVersion: 1,
      packageId,
      version: "9.0.0-service",
      minimumRuntime: "DV11",
      contentHash: `fnv1a:${stableHash(JSON.stringify(contents))}`,
      generatedAt: "2026-08-12",
      dependencies: [],
      counts: { entities: 0, propositions: 0, senses: 0, schemas: 0, rules: 0, lexemes: 1, lexicalSenses: lexicalSenses.length, lexicalClaims: lexicalClaims.length },
      capabilities: ["server-resolved-lexeme", "separate-lexical-senses", "compiled-lexical-dialogue"],
    },
    ...contents,
  };
}
