import { dv10Evidence } from "@/modules/dv10";
import { lexiKnowledgeGraph } from "@/modules/knowledge-graph";
import type { EntityKind, KnowledgeProposition, PropositionValue } from "@/modules/knowledge-graph/types";
import { dv11NormalizeText, dv11Tokens, stableHash } from "./normalize";
import { dv11PredicateSchema, dv11PredicateSchemas, registerDv11PredicateSchema } from "./schema";
import type {
  Dv11Entity,
  Dv11EntityCandidate,
  Dv11EntityKind,
  Dv11KnowledgePackage,
  Dv11Lexeme,
  Dv11LexicalClaim,
  Dv11LexicalSense,
  Dv11PackageManifest,
  Dv11PredicateSchema,
  Dv11Proposition,
  Dv11SenseCandidate,
  Dv11TemporalConstraint,
  Dv11Value,
} from "./types";

type TrieNode = { children: Map<string, TrieNode>; entityIds: Set<string> };

function trieNode(): TrieNode {
  return { children: new Map(), entityIds: new Set() };
}

function valueKey(value: Dv11Value): string {
  return JSON.stringify(value);
}

function legacyKind(kind: EntityKind): Dv11EntityKind {
  return kind === "food" ? "object" : kind;
}

function convertLegacyValue(value: PropositionValue): Dv11Value {
  if (value.kind === "entity") return { kind: "entity", entityId: value.entityId };
  if (value.kind === "text") return { kind: "text", value: value.value };
  if (value.kind === "number") {
    return value.unit
      ? { kind: "quantity", quantity: { value: value.value, unit: value.unit } }
      : { kind: "number", value: value.value };
  }
  if (value.kind === "boolean") return { kind: "boolean", value: value.value };
  return { kind: "ordered-list", values: value.values.map((item) => ({ kind: "text", value: item })) };
}

function convertLegacyTemporal(value?: string): Dv11TemporalConstraint | undefined {
  if (!value) return undefined;
  const year = value.match(/\b\d{4}\b/)?.[0];
  return year ? { kind: "point", value: year } : { kind: "historical", value };
}

function legacyProposition(proposition: KnowledgeProposition): Dv11Proposition {
  return {
    id: `legacy:${proposition.id}`,
    subjectId: proposition.subjectId,
    relation: proposition.predicate,
    object: convertLegacyValue(proposition.object),
    qualifiers: {
      scope: proposition.qualifiers?.scope,
      temporal: convertLegacyTemporal(proposition.qualifiers?.time),
    },
    provenance: [{
      sourceId: proposition.source,
      sourceLocation: `legacy-graph:${proposition.id}`,
      extractionMethod: proposition.source === "derived" ? "mechanically-derived" : "imported",
      reviewStatus: proposition.source === "derived" ? "mechanically-derived" : "source-attested",
      confidence: proposition.source === "derived" ? 0.76 : 0.88,
      createdAt: "2026-07-31",
      license: "alphaine-project-data",
      disputeStatus: "undisputed",
    }],
    polarity: "positive",
  };
}

export function dv11PackageContentHash(pack: Omit<Dv11KnowledgePackage, "manifest">): string {
  return `fnv1a:${stableHash(JSON.stringify(pack))}`;
}

export class Dv11KnowledgeStore {
  private readonly entities = new Map<string, Dv11Entity>();
  private readonly aliases = new Map<string, Set<string>>();
  private readonly aliasTrie = trieNode();
  private readonly correctionBuckets = new Map<string, Set<string>>();
  private readonly propositions = new Map<string, Dv11Proposition>();
  private readonly bySubject = new Map<string, Set<string>>();
  private readonly byRelation = new Map<string, Set<string>>();
  private readonly byObject = new Map<string, Set<string>>();
  private readonly bySubjectRelation = new Map<string, Set<string>>();
  private readonly senses = new Map<string, Dv11SenseCandidate>();
  private readonly lexemes = new Map<string, Dv11Lexeme>();
  private readonly lexicalAliases = new Map<string, Set<string>>();
  private readonly lexicalSenses = new Map<string, Dv11LexicalSense>();
  private readonly lexicalClaims = new Map<string, Dv11LexicalClaim>();
  private readonly packageManifests = new Map<string, Dv11PackageManifest>();

  addEntity(entity: Dv11Entity) {
    const existing = this.entities.get(entity.id);
    if (existing && (existing.canonicalName !== entity.canonicalName || existing.kind !== entity.kind)) {
      throw new Error(`Entity identity conflict for ${entity.id}.`);
    }
    const merged: Dv11Entity = existing
      ? { ...existing, aliases: [...new Set([...existing.aliases, ...entity.aliases])], senseIds: [...new Set([...existing.senseIds, ...entity.senseIds])] }
      : { ...entity, aliases: [...new Set(entity.aliases)], senseIds: [...new Set(entity.senseIds)] };
    this.entities.set(entity.id, merged);
    for (const alias of [merged.canonicalName, ...merged.aliases]) this.indexAlias(alias, entity.id);
    return merged;
  }

  ensureEntity(name: string, kind: Dv11EntityKind = "unknown", preferredId?: string) {
    const exact = this.resolveExact(name);
    if (exact.length === 1) return this.entities.get(exact[0].entityId)!;
    const id = preferredId ?? `entity:${dv11NormalizeText(name).replace(/[^\p{L}\p{N}]+/gu, "-")}`;
    return this.addEntity({ id, canonicalName: name, kind, aliases: [], senseIds: [] });
  }

  private indexAlias(alias: string, entityId: string) {
    const normalized = dv11NormalizeText(alias).replace(/^(?:a|an|the)\s+/, "").trim();
    if (!normalized) return;
    const forms = new Set([normalized]);
    if (/^[\p{L}\p{M}-]+$/u.test(normalized) && !/(?:s|x|z|ch|sh)$/u.test(normalized)) forms.add(`${normalized}s`);
    for (const form of forms) {
      const candidates = this.aliases.get(form) ?? new Set<string>();
      candidates.add(entityId);
      this.aliases.set(form, candidates);
      if (!form.includes(" ") && form.length >= 5) {
        const bucketKey = `${form[0]}:${form.length}`;
        const bucket = this.correctionBuckets.get(bucketKey) ?? new Set<string>();
        bucket.add(form);
        this.correctionBuckets.set(bucketKey, bucket);
      }
      let node = this.aliasTrie;
      for (const token of form.split(" ")) {
        const next = node.children.get(token) ?? trieNode();
        node.children.set(token, next);
        node = next;
      }
      node.entityIds.add(entityId);
    }
  }

  addSense(sense: Dv11SenseCandidate) {
    if (!this.entities.has(sense.entityId)) throw new Error(`Missing sense entity ${sense.entityId} for ${sense.senseId}.`);
    const existing = this.senses.get(sense.senseId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(sense)) throw new Error(`Sense conflict for ${sense.senseId}.`);
    this.senses.set(sense.senseId, { ...sense, domains: [...sense.domains], evidence: [...sense.evidence] });
  }

  addLexeme(lexeme: Dv11Lexeme) {
    const existing = this.lexemes.get(lexeme.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(lexeme)) throw new Error(`Lexeme conflict for ${lexeme.id}.`);
    this.lexemes.set(lexeme.id, { ...lexeme, aliases: [...lexeme.aliases], senseIds: [...lexeme.senseIds] });
    for (const alias of [lexeme.lemma, ...lexeme.aliases]) {
      const normalized = dv11NormalizeText(alias);
      if (!normalized) continue;
      const ids = this.lexicalAliases.get(normalized) ?? new Set<string>();
      ids.add(lexeme.id);
      this.lexicalAliases.set(normalized, ids);
    }
  }

  addLexicalSense(sense: Dv11LexicalSense) {
    if (!this.lexemes.has(sense.lexemeId)) throw new Error(`Missing lexeme ${sense.lexemeId} for lexical sense ${sense.id}.`);
    const existing = this.lexicalSenses.get(sense.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(sense)) throw new Error(`Lexical sense conflict for ${sense.id}.`);
    this.lexicalSenses.set(sense.id, { ...sense, domains: [...sense.domains], contextualFeatures: [...sense.contextualFeatures], provenance: [...sense.provenance] });
  }

  addLexicalClaim(claim: Dv11LexicalClaim) {
    if (!this.lexemes.has(claim.lexemeId)) throw new Error(`Missing lexeme ${claim.lexemeId} for lexical claim ${claim.id}.`);
    if (claim.senseId && !this.lexicalSenses.has(claim.senseId)) throw new Error(`Missing lexical sense ${claim.senseId} for ${claim.id}.`);
    const existing = this.lexicalClaims.get(claim.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(claim)) throw new Error(`Lexical claim conflict for ${claim.id}.`);
    this.lexicalClaims.set(claim.id, { ...claim, values: [...claim.values], provenance: [...claim.provenance] });
  }

  addProposition(proposition: Dv11Proposition) {
    if (this.propositions.has(proposition.id)) {
      const existing = this.propositions.get(proposition.id)!;
      if (JSON.stringify(existing) !== JSON.stringify(proposition)) throw new Error(`Proposition ID conflict for ${proposition.id}.`);
      return existing;
    }
    if (!this.entities.has(proposition.subjectId)) throw new Error(`Missing subject ${proposition.subjectId} for ${proposition.id}.`);
    const schema = dv11PredicateSchema(proposition.relation);
    if (!schema) throw new Error(`Missing predicate schema for ${proposition.relation}.`);
    if (!schema.range.includes(proposition.object.kind)) throw new Error(`Invalid ${proposition.object.kind} value for ${proposition.relation}.`);
    if (proposition.object.kind === "entity" && !this.entities.has(proposition.object.entityId)) {
      throw new Error(`Missing object ${proposition.object.entityId} for ${proposition.id}.`);
    }
    if (!proposition.provenance.length) throw new Error(`Missing provenance for ${proposition.id}.`);
    if (proposition.provenance.some((source) => !source.sourceId || !source.sourceLocation || !source.createdAt || !source.license || !source.disputeStatus)) throw new Error(`Incomplete claim-level provenance for ${proposition.id}.`);
    this.propositions.set(proposition.id, proposition);
    this.addIndex(this.bySubject, proposition.subjectId, proposition.id);
    this.addIndex(this.byRelation, proposition.relation, proposition.id);
    this.addIndex(this.byObject, valueKey(proposition.object), proposition.id);
    this.addIndex(this.bySubjectRelation, `${proposition.subjectId}\u0000${proposition.relation}`, proposition.id);
    return proposition;
  }

  private addIndex(index: Map<string, Set<string>>, key: string, propositionId: string) {
    const values = index.get(key) ?? new Set<string>();
    values.add(propositionId);
    index.set(key, values);
  }

  addPackage(pack: Dv11KnowledgePackage) {
    const errors = validateDv11Package(pack, this.packageManifests);
    if (errors.length) throw new Error(errors.join("\n"));
    const entitySnapshot = new Map(this.entities);
    const propositionSnapshot = new Map(this.propositions);
    const senseSnapshot = new Map(this.senses);
    const lexemeSnapshot = new Map(this.lexemes);
    const lexicalSenseSnapshot = new Map(this.lexicalSenses);
    const lexicalClaimSnapshot = new Map(this.lexicalClaims);
    const manifestSnapshot = new Map(this.packageManifests);
    const schemaSnapshot = new Map(dv11PredicateSchemas);
    try {
      for (const schema of pack.schemas) registerDv11PredicateSchema(schema);
      for (const entity of pack.entities) this.addEntity(entity);
      for (const lexeme of pack.lexemes ?? []) this.addLexeme(lexeme);
      for (const sense of pack.senses) this.addSense(sense);
      for (const sense of pack.lexicalSenses ?? []) this.addLexicalSense(sense);
      for (const claim of pack.lexicalClaims ?? []) this.addLexicalClaim(claim);
      for (const proposition of pack.propositions) this.addProposition(proposition);
      this.packageManifests.set(pack.manifest.packageId, pack.manifest);
    } catch (error) {
      this.entities.clear();
      this.propositions.clear();
      this.senses.clear();
      this.lexemes.clear();
      this.lexicalSenses.clear();
      this.lexicalClaims.clear();
      this.packageManifests.clear();
      dv11PredicateSchemas.clear();
      for (const [id, entity] of entitySnapshot) this.entities.set(id, entity);
      for (const [id, proposition] of propositionSnapshot) this.propositions.set(id, proposition);
      for (const [id, sense] of senseSnapshot) this.senses.set(id, sense);
      for (const [id, lexeme] of lexemeSnapshot) this.lexemes.set(id, lexeme);
      for (const [id, sense] of lexicalSenseSnapshot) this.lexicalSenses.set(id, sense);
      for (const [id, claim] of lexicalClaimSnapshot) this.lexicalClaims.set(id, claim);
      for (const [id, manifest] of manifestSnapshot) this.packageManifests.set(id, manifest);
      for (const [id, schema] of schemaSnapshot) dv11PredicateSchemas.set(id, schema);
      this.rebuildIndexes();
      throw error;
    }
  }

  private rebuildIndexes() {
    this.aliases.clear();
    this.aliasTrie.children.clear();
    this.aliasTrie.entityIds.clear();
    this.correctionBuckets.clear();
    this.lexicalAliases.clear();
    this.bySubject.clear();
    this.byRelation.clear();
    this.byObject.clear();
    this.bySubjectRelation.clear();
    for (const entity of this.entities.values()) for (const alias of [entity.canonicalName, ...entity.aliases]) this.indexAlias(alias, entity.id);
    for (const lexeme of this.lexemes.values()) for (const alias of [lexeme.lemma, ...lexeme.aliases]) {
      const normalized = dv11NormalizeText(alias);
      const ids = this.lexicalAliases.get(normalized) ?? new Set<string>();
      ids.add(lexeme.id);
      this.lexicalAliases.set(normalized, ids);
    }
    for (const proposition of this.propositions.values()) {
      this.addIndex(this.bySubject, proposition.subjectId, proposition.id);
      this.addIndex(this.byRelation, proposition.relation, proposition.id);
      this.addIndex(this.byObject, valueKey(proposition.object), proposition.id);
      this.addIndex(this.bySubjectRelation, `${proposition.subjectId}\u0000${proposition.relation}`, proposition.id);
    }
  }

  entity(id: string) { return this.entities.get(id); }
  proposition(id: string) { return this.propositions.get(id); }
  allEntities() { return [...this.entities.values()]; }
  allPropositions() { return [...this.propositions.values()]; }
  allSenses() { return [...this.senses.values()]; }
  allLexemes() { return [...this.lexemes.values()]; }
  allLexicalSenses() { return [...this.lexicalSenses.values()]; }
  allLexicalClaims() { return [...this.lexicalClaims.values()]; }
  sensesForEntity(entityId: string) { return [...this.senses.values()].filter((sense) => sense.entityId === entityId); }
  resolveLexeme(text: string) { return [...(this.lexicalAliases.get(dv11NormalizeText(text)) ?? [])].map((id) => this.lexemes.get(id)).filter((value): value is Dv11Lexeme => Boolean(value)); }
  lexicalSensesFor(lexemeId: string) { return [...this.lexicalSenses.values()].filter((sense) => sense.lexemeId === lexemeId); }
  lexicalClaimsFor(lexemeId: string, senseId?: string) { return [...this.lexicalClaims.values()].filter((claim) => claim.lexemeId === lexemeId && (!senseId || !claim.senseId || claim.senseId === senseId)); }
  manifests() { return [...this.packageManifests.values()]; }

  private propositionsFor(index: Map<string, Set<string>>, key: string) {
    return [...(index.get(key) ?? [])].map((id) => this.propositions.get(id)).filter((value): value is Dv11Proposition => Boolean(value));
  }

  direct(subjectId: string, relation?: string) {
    return relation
      ? this.propositionsFor(this.bySubjectRelation, `${subjectId}\u0000${relation}`)
      : this.propositionsFor(this.bySubject, subjectId);
  }

  relation(relation: string) { return this.propositionsFor(this.byRelation, relation); }
  inverse(relation: string, object: Dv11Value) {
    return this.propositionsFor(this.byObject, valueKey(object)).filter((proposition) => proposition.relation === relation);
  }

  resolveExact(text: string): Dv11EntityCandidate[] {
    const normalized = dv11NormalizeText(text).replace(/^(?:a|an|the)\s+/, "").replace(/(?:'s|s')$/, "").trim();
    return [...(this.aliases.get(normalized) ?? [])].map((entityId) => {
      const entity = this.entities.get(entityId)!;
      return { entityId, canonicalName: entity.canonicalName, kind: entity.kind, alias: normalized, score: 1 / Math.max(1, this.aliases.get(normalized)?.size ?? 1), evidence: [`alias:${normalized}`] };
    });
  }

  findMentions(text: string) {
    const normalized = dv11NormalizeText(text);
    const tokens = dv11Tokens(normalized).filter((token) => /^[\p{L}\p{M}\p{N}'-]+$/u.test(token));
    const offsets: number[] = [];
    let cursor = 0;
    for (const token of tokens) {
      offsets.push(normalized.indexOf(token, cursor));
      cursor = offsets.at(-1)! + token.length;
    }
    const matches: Array<{ start: number; end: number; text: string; candidates: Dv11EntityCandidate[] }> = [];
    for (let start = 0; start < tokens.length; start += 1) {
      let node = this.aliasTrie;
      for (let end = start; end < tokens.length; end += 1) {
        const next = node.children.get(tokens[end]);
        if (!next) break;
        node = next;
        if (!node.entityIds.size) continue;
        const alias = tokens.slice(start, end + 1).join(" ");
        const candidates = [...node.entityIds].map((entityId) => {
          const entity = this.entities.get(entityId)!;
          return { entityId, canonicalName: entity.canonicalName, kind: entity.kind, alias, score: alias.split(" ").length / (alias.split(" ").length + node.entityIds.size - 1), evidence: [`trie-alias:${alias}`] } satisfies Dv11EntityCandidate;
        });
        matches.push({ start: offsets[start], end: offsets[end] + tokens[end].length, text: alias, candidates });
      }
    }
    const coveredStarts = new Set(matches.map((match) => match.start));
    const oneEditApart = (left: string, right: string) => {
      if (Math.abs(left.length - right.length) > 1) return false;
      let leftIndex = 0; let rightIndex = 0; let edits = 0;
      while (leftIndex < left.length && rightIndex < right.length) {
        if (left[leftIndex] === right[rightIndex]) { leftIndex += 1; rightIndex += 1; continue; }
        edits += 1;
        if (edits > 1) return false;
        if (left.length > right.length) leftIndex += 1;
        else if (right.length > left.length) rightIndex += 1;
        else { leftIndex += 1; rightIndex += 1; }
      }
      return edits + Number(leftIndex < left.length || rightIndex < right.length) === 1;
    };
    const correctionStopWords = new Set([
      "about", "after", "before", "cause", "contents", "contrast", "could", "define", "describe", "exactly", "explain", "favorite",
      "given", "please", "should", "state", "their", "there", "these", "those", "which", "whole", "would",
    ]);
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.length < 5 || correctionStopWords.has(token) || coveredStarts.has(offsets[index])) continue;
      const aliases = [-1, 0, 1].flatMap((delta) => [...(this.correctionBuckets.get(`${token[0]}:${token.length + delta}`) ?? [])]).filter((alias) => oneEditApart(token, alias));
      if (aliases.length !== 1) continue;
      const alias = aliases[0];
      const candidates = [...(this.aliases.get(alias) ?? [])].map((entityId) => {
        const entity = this.entities.get(entityId)!;
        return { entityId, canonicalName: entity.canonicalName, kind: entity.kind, alias, score: 0.68 / Math.max(1, this.aliases.get(alias)?.size ?? 1), evidence: [`controlled-spelling:${token}->${alias}`] } satisfies Dv11EntityCandidate;
      });
      if (candidates.length) matches.push({ start: offsets[index], end: offsets[index] + token.length, text: token, candidates });
    }
    return matches
      .sort((left, right) => left.start - right.start || right.end - right.start - (left.end - left.start))
      .filter((match, index, all) => !all.slice(0, index).some((prior) => match.start >= prior.start && match.end <= prior.end));
  }

  conflictsFor(proposition: Dv11Proposition) {
    const schema = dv11PredicateSchema(proposition.relation);
    if (!schema?.functional) return [];
    const candidates = this.currentFacts(this.direct(proposition.subjectId, proposition.relation));
    const superseded = new Set(candidates.flatMap((candidate) => candidate.supersedes ?? []));
    return candidates.filter((candidate) => !superseded.has(candidate.id))
      .filter((candidate) => candidate.id !== proposition.id && valueKey(candidate.object) !== valueKey(proposition.object));
  }

  currentFacts(facts: Dv11Proposition[], at = new Date()) {
    const instant = at.toISOString();
    return facts.filter((fact) => fact.provenance.some((source) => (!source.validFrom || source.validFrom <= instant) && (!source.validTo || source.validTo >= instant)));
  }

  stats() {
    return {
      worldEntities: this.entities.size,
      worldAliases: this.aliases.size,
      worldPropositions: this.propositions.size,
      worldSenses: this.senses.size,
      lexemes: this.lexemes.size,
      lexicalAliases: this.lexicalAliases.size,
      lexicalSenses: this.lexicalSenses.size,
      lexicalClaims: this.lexicalClaims.size,
      installedPackages: this.packageManifests.size,
      queryableClaims: this.propositions.size + this.lexicalClaims.size,
    };
  }

  validateIntegrity() {
    const errors: string[] = [];
    for (const proposition of this.propositions.values()) {
      if (!this.entities.has(proposition.subjectId)) errors.push(`Missing subject ${proposition.subjectId}.`);
      if (proposition.object.kind === "entity" && !this.entities.has(proposition.object.entityId)) errors.push(`Missing object ${proposition.object.entityId}.`);
      if (!dv11PredicateSchema(proposition.relation)) errors.push(`Missing schema ${proposition.relation}.`);
      if (!this.bySubject.get(proposition.subjectId)?.has(proposition.id)) errors.push(`Stale subject index for ${proposition.id}.`);
      if (!this.byRelation.get(proposition.relation)?.has(proposition.id)) errors.push(`Stale relation index for ${proposition.id}.`);
      if (!this.byObject.get(valueKey(proposition.object))?.has(proposition.id)) errors.push(`Stale object index for ${proposition.id}.`);
      if (!this.bySubjectRelation.get(`${proposition.subjectId}\u0000${proposition.relation}`)?.has(proposition.id)) errors.push(`Stale subject-relation index for ${proposition.id}.`);
    }
    for (const [key, ids] of [...this.bySubject, ...this.byRelation, ...this.byObject, ...this.bySubjectRelation]) for (const id of ids) if (!this.propositions.has(id)) errors.push(`Index ${key} points to missing ${id}.`);
    for (const sense of this.senses.values()) if (!this.entities.has(sense.entityId)) errors.push(`Sense ${sense.senseId} points to missing ${sense.entityId}.`);
    for (const sense of this.lexicalSenses.values()) if (!this.lexemes.has(sense.lexemeId)) errors.push(`Lexical sense ${sense.id} points to missing ${sense.lexemeId}.`);
    for (const claim of this.lexicalClaims.values()) {
      if (!this.lexemes.has(claim.lexemeId)) errors.push(`Lexical claim ${claim.id} points to missing ${claim.lexemeId}.`);
      if (claim.senseId && !this.lexicalSenses.has(claim.senseId)) errors.push(`Lexical claim ${claim.id} points to missing ${claim.senseId}.`);
    }
    return [...new Set(errors)];
  }
}

export function validateDv11Package(pack: Dv11KnowledgePackage, installed = new Map<string, Dv11PackageManifest>()) {
  const errors: string[] = [];
  if (pack.manifest.schemaVersion !== 1) errors.push("Unsupported package schema version.");
  if (pack.manifest.minimumRuntime !== "DV11") errors.push("Package runtime is incompatible with DV11.");
  if (pack.manifest.counts.entities !== pack.entities.length) errors.push("Entity count does not match manifest.");
  if (pack.manifest.counts.propositions !== pack.propositions.length) errors.push("Proposition count does not match manifest.");
  if (pack.manifest.counts.senses !== pack.senses.length) errors.push("Sense count does not match manifest.");
  if (pack.manifest.counts.schemas !== pack.schemas.length) errors.push("Schema count does not match manifest.");
  if ((pack.manifest.counts.lexemes ?? 0) !== (pack.lexemes?.length ?? 0)) errors.push("Lexeme count does not match manifest.");
  if ((pack.manifest.counts.lexicalClaims ?? 0) !== (pack.lexicalClaims?.length ?? 0)) errors.push("Lexical claim count does not match manifest.");
  if ((pack.manifest.counts.lexicalSenses ?? 0) !== (pack.lexicalSenses?.length ?? 0)) errors.push("Lexical sense count does not match manifest.");
  const expectedHash = dv11PackageContentHash({
    entities: pack.entities,
    propositions: pack.propositions,
    schemas: pack.schemas,
    senses: pack.senses,
    ...(pack.lexemes ? { lexemes: pack.lexemes } : {}),
    ...(pack.lexicalSenses ? { lexicalSenses: pack.lexicalSenses } : {}),
    ...(pack.lexicalClaims ? { lexicalClaims: pack.lexicalClaims } : {}),
  });
  if (pack.manifest.contentHash.startsWith("fnv1a:") && pack.manifest.contentHash !== expectedHash) errors.push("Package content hash is invalid.");
  for (const dependency of pack.manifest.dependencies) if (!installed.has(dependency.packageId)) errors.push(`Missing dependency ${dependency.packageId}.`);
  if (new Set(pack.entities.map((item) => item.id)).size !== pack.entities.length) errors.push("Duplicate entity IDs in package.");
  if (new Set(pack.propositions.map((item) => item.id)).size !== pack.propositions.length) errors.push("Duplicate proposition IDs in package.");
  if (new Set((pack.lexemes ?? []).map((item) => item.id)).size !== (pack.lexemes?.length ?? 0)) errors.push("Duplicate lexeme IDs in package.");
  if (new Set((pack.lexicalSenses ?? []).map((item) => item.id)).size !== (pack.lexicalSenses?.length ?? 0)) errors.push("Duplicate lexical sense IDs in package.");
  if (new Set((pack.lexicalClaims ?? []).map((item) => item.id)).size !== (pack.lexicalClaims?.length ?? 0)) errors.push("Duplicate lexical claim IDs in package.");
  return errors;
}

function corePackage(): Dv11KnowledgePackage {
  const entities: Dv11Entity[] = lexiKnowledgeGraph.allEntities().map((entity) => ({ id: entity.id, canonicalName: entity.name, kind: legacyKind(entity.kind), aliases: [...entity.aliases], senseIds: [] }));
  const propositions = lexiKnowledgeGraph.allPropositions().map(legacyProposition);
  const existingEntityId = (name: string, aliases: readonly string[] = []) => {
    const forms = new Set([name, ...aliases].map((value) => dv11NormalizeText(value).replace(/^(?:a|an|the)\s+/, "")));
    const matches = entities.filter((entity) => [entity.canonicalName, ...entity.aliases].some((alias) => forms.has(dv11NormalizeText(alias).replace(/^(?:a|an|the)\s+/, ""))));
    return matches.length === 1 ? matches[0].id : undefined;
  };
  for (const item of dv10Evidence) {
    const subjectId = existingEntityId(item.subject, item.subjectAliases) ?? `dv10:${dv11NormalizeText(item.subject).replace(/[^a-z0-9]+/g, "-")}`;
    if (!entities.some((entity) => entity.id === subjectId)) entities.push({ id: subjectId, canonicalName: item.subject, kind: "concept", aliases: [...item.subjectAliases], senseIds: [] });
    let object: Dv11Value;
    if (item.object.kind === "text") object = { kind: "text", value: item.object.value };
    else if (item.object.kind === "number") object = item.object.unit ? { kind: "quantity", quantity: { value: item.object.value, unit: item.object.unit } } : { kind: "number", value: item.object.value };
    else if (item.object.kind === "list") object = { kind: "ordered-list", values: item.object.values.map((value) => ({ kind: "text", value })) };
    else {
      const entityId = existingEntityId(item.object.value) ?? `dv10:${dv11NormalizeText(item.object.value).replace(/[^a-z0-9]+/g, "-")}`;
      if (!entities.some((entity) => entity.id === entityId)) entities.push({ id: entityId, canonicalName: item.object.value, kind: "unknown", aliases: [], senseIds: [] });
      object = { kind: "entity", entityId };
    }
    propositions.push({
      id: item.id,
      subjectId,
      relation: item.predicate,
      object,
      qualifiers: {
        scope: [item.qualifiers?.scope, item.qualifiers?.condition].filter(Boolean).join("; ") || undefined,
        condition: item.qualifiers?.condition
          ? { kind: "counterfactual", premiseText: item.qualifiers.condition }
          : undefined,
        temporal: convertLegacyTemporal(item.qualifiers?.time),
      },
      provenance: [{
        sourceId: item.provenance.sourceId,
        sourceLocation: item.provenance.url,
        title: item.provenance.title,
        extractionMethod: item.provenance.reviewStatus === "source-reviewed" ? "curated" : "mechanically-derived",
        reviewStatus: item.provenance.reviewStatus === "source-reviewed" ? "independently-reviewed" : "mechanically-derived",
        confidence: item.provenance.confidence,
        createdAt: "2026-08-11",
        validFrom: item.provenance.validFrom,
        validTo: item.provenance.validTo,
        license: "source-license-not-embedded",
        disputeStatus: "undisputed",
      }],
      polarity: "positive",
    });
  }
  const addEntity = (entity: Dv11Entity) => {
    if (!entities.some((candidate) => candidate.id === entity.id)) entities.push(entity);
  };
  addEntity({ id: "time-week", canonicalName: "week", kind: "concept", aliases: ["weeks"], senseIds: [] });
  addEntity({ id: "time-day", canonicalName: "day", kind: "concept", aliases: ["days"], senseIds: [] });
  addEntity({ id: "shape-triangle", canonicalName: "triangle", kind: "concept", aliases: ["triangles", "three-sided polygon"], senseIds: [] });
  addEntity({ id: "place-river-bank", canonicalName: "river bank", kind: "place", aliases: ["bank", "riverbank", "side of a river"], senseIds: ["sense:bank:river"] });
  const financialBank = entities.find((entity) => entity.id === "place-bank");
  if (financialBank) financialBank.senseIds = [...new Set([...financialBank.senseIds, "sense:bank:finance"])];
  const financialDefinition = propositions.find((proposition) => proposition.subjectId === "place-bank" && proposition.relation === "definition" && proposition.object.kind === "text");
  if (financialDefinition?.object.kind === "text") financialDefinition.object = { kind: "text", value: "a regulated financial institution that holds money and provides financial services" };
  const provenance = (location: string) => [{ sourceId: "dv11-curated-foundations", sourceLocation: location, extractionMethod: "curated" as const, reviewStatus: "independently-reviewed" as const, confidence: 0.99, createdAt: "2026-08-12", license: "project-internal", disputeStatus: "undisputed" as const }];
  propositions.push(
    { id: "dv11:week:day-count", subjectId: "time-week", relation: "count", object: { kind: "number", value: 7 }, qualifiers: { scope: "days in one standard calendar week" }, provenance: provenance("foundations:week"), polarity: "positive" },
    { id: "dv11:triangle:definition", subjectId: "shape-triangle", relation: "definition", object: { kind: "text", value: "a polygon with three sides and three angles" }, qualifiers: {}, provenance: provenance("foundations:triangle"), polarity: "positive" },
    { id: "dv11:river-bank:definition", subjectId: "place-river-bank", relation: "definition", object: { kind: "text", value: "the sloping land beside a river" }, qualifiers: {}, provenance: provenance("foundations:bank-senses"), polarity: "positive" },
    { id: "dv11:ice:warming-transition", subjectId: "material-ice", relation: "state_transition", object: { kind: "text", value: "adding enough heat raises molecular motion and changes solid ice into liquid water" }, qualifiers: { condition: { kind: "counterfactual", premiseText: "ice is warmed above its melting point" } }, provenance: provenance("foundations:ice-transition"), polarity: "positive" },
    { id: "dv11:egg:boiling-procedure", subjectId: "food-egg", relation: "procedure", object: { kind: "ordered-list", values: [
      { kind: "text", value: "put the egg in water" }, { kind: "text", value: "heat the water to a boil" }, { kind: "text", value: "cook the egg until the desired firmness" }, { kind: "text", value: "cool and peel the egg" },
    ] }, qualifiers: { scope: "boiling an egg" }, provenance: provenance("foundations:egg-procedure"), polarity: "positive" },
    { id: "dv11:saturn:diameter", subjectId: "space-saturn", relation: "size", object: { kind: "quantity", quantity: { value: 116_460, unit: "kilometer", dimension: "length", significantFigures: 6 } }, qualifiers: { scope: "equatorial diameter" }, provenance: provenance("foundations:saturn-diameter"), polarity: "positive" },
    { id: "dv11:photosynthesis:energy", subjectId: "process-photosynthesis", relation: "definition", object: { kind: "text", value: "a process that uses light to make sugars that store chemical energy" }, qualifiers: {}, provenance: provenance("foundations:photosynthesis-energy"), polarity: "positive" },
  );
  const senses: Dv11SenseCandidate[] = [
    { senseId: "sense:bank:finance", entityId: "place-bank", lemma: "bank", partOfSpeech: "noun", domains: ["finance", "economics"], definition: "a regulated financial institution", aliases: ["financial bank"], usages: ["deposit money at a bank"], contextualFeatures: ["money", "finance", "account", "deposit", "loan", "payment"], score: 1, evidence: ["curated-sense:bank-finance", "default-unmarked-sense"] },
    { senseId: "sense:bank:river", entityId: "place-river-bank", lemma: "bank", partOfSpeech: "noun", domains: ["geography", "river"], definition: "land beside a river", aliases: ["river bank", "riverbank"], usages: ["sit on the river bank"], contextualFeatures: ["river", "water", "shore", "stream", "sloping", "land"], score: 0.7, evidence: ["curated-sense:bank-river"] },
  ];
  const contents = { entities, propositions, schemas: [] as Dv11PredicateSchema[], senses };
  return {
    manifest: {
      schemaVersion: 1,
      packageId: "alphaine.lexi.core",
      version: "11.0.0",
      minimumRuntime: "DV11",
      contentHash: dv11PackageContentHash(contents),
      generatedAt: "2026-08-12",
      dependencies: [],
      counts: { entities: entities.length, propositions: propositions.length, senses: senses.length, schemas: 0, rules: 0 },
      capabilities: ["legacy-graph", "dv10-reviewed-propositions", "explicit-senses", "curated-foundations"],
    },
    ...contents,
  };
}

export function createDv11KnowledgeStore() {
  const store = new Dv11KnowledgeStore();
  store.addPackage(corePackage());
  return store;
}

export const dv11KnowledgeStore = createDv11KnowledgeStore();
