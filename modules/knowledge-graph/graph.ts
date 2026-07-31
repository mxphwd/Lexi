import { knowledgeTopics } from "@/modules/extended-pack/topics";
import { normalizeText } from "@/modules/search/tokenize";
import type {
  SemanticEntityMention,
  SemanticRelation,
  SemanticResolver,
} from "@/modules/semantic/types";
import { coreKnowledgeSeeds } from "./data/core-basics";
import { everydayKnowledgeSeeds } from "./data/everyday-basics";
import { scienceKnowledgeSeeds } from "./data/science-basics";
import { worldAndPeopleKnowledgeSeeds } from "./data/world-people";
import type {
  EntityKind,
  EntitySeedFact,
  KnowledgeEntity,
  KnowledgeEntitySeed,
  KnowledgeProposition,
  PropositionValue,
} from "./types";

function normalizeAlias(value: string): string {
  return normalizeText(value)
    .replace(/^(?:a|an|the)\s+/, "")
    .replace(/(?:'s|s')$/, "")
    .trim();
}

function propositionValue(fact: EntitySeedFact): {
  object: PropositionValue;
  qualifiers?: KnowledgeProposition["qualifiers"];
} {
  if (typeof fact === "string") {
    return { object: { kind: "text", value: fact } };
  }
  if (typeof fact === "number") {
    return { object: { kind: "number", value: fact } };
  }
  if (typeof fact === "boolean") {
    return { object: { kind: "boolean", value: fact } };
  }
  if (Array.isArray(fact)) {
    return {
      object: {
        kind: "list",
        values: fact.map(String),
      },
    };
  }

  const qualifiers = {
    condition: fact.condition,
    time: fact.time,
    scope: fact.scope,
  };
  const hasQualifiers = Object.values(qualifiers).some(Boolean);
  let object: PropositionValue;
  if (fact.entity && typeof fact.value === "string") {
    object = { kind: "entity", entityId: fact.value };
  } else if (Array.isArray(fact.value)) {
    object = { kind: "list", values: fact.value.map(String) };
  } else if (typeof fact.value === "number") {
    object = { kind: "number", value: fact.value, unit: fact.unit };
  } else if (typeof fact.value === "boolean") {
    object = { kind: "boolean", value: fact.value };
  } else {
    object = { kind: "text", value: String(fact.value) };
  }
  return {
    object,
    qualifiers: hasQualifiers ? qualifiers : undefined,
  };
}

function factEntries(
  fact: EntitySeedFact | readonly EntitySeedFact[],
): EntitySeedFact[] {
  if (!Array.isArray(fact)) return [fact];
  if (fact.length > 0 && fact.every((item) => typeof item === "object" && !Array.isArray(item))) {
    return [...fact] as EntitySeedFact[];
  }
  return [fact as readonly string[]];
}

export class KnowledgeGraph implements SemanticResolver {
  private readonly entities = new Map<string, KnowledgeEntity>();
  private readonly aliases = new Map<string, string>();
  private readonly propositions = new Map<string, KnowledgeProposition>();
  private readonly propositionSignatures = new Map<string, string>();
  private readonly bySubject = new Map<string, KnowledgeProposition[]>();
  private readonly bySubjectPredicate = new Map<string, KnowledgeProposition[]>();
  private readonly aliasEntries: Array<[string, string]> = [];
  private propositionSequence = 0;

  addEntity(entity: KnowledgeEntity): KnowledgeEntity {
    const existing = this.entities.get(entity.id);
    const merged: KnowledgeEntity = existing
      ? {
          ...existing,
          aliases: [...new Set([...existing.aliases, ...entity.aliases])],
        }
      : {
          ...entity,
          aliases: [...new Set(entity.aliases)],
        };
    this.entities.set(merged.id, merged);
    for (const alias of [merged.name, ...merged.aliases]) {
      const normalized = normalizeAlias(alias);
      if (normalized && !this.aliases.has(normalized)) {
        this.aliases.set(normalized, merged.id);
      }
    }
    return merged;
  }

  ensureEntity(
    name: string,
    kind: EntityKind = "concept",
    aliases: readonly string[] = [],
    preferredId?: string,
  ): KnowledgeEntity {
    const existingId = this.aliases.get(normalizeAlias(name));
    if (existingId) {
      const existing = this.entities.get(existingId)!;
      return this.addEntity({
        ...existing,
        aliases: [...existing.aliases, ...aliases],
      });
    }
    const id = preferredId ?? `entity-${normalizeAlias(name).replace(/\s+/g, "-")}`;
    return this.addEntity({ id, name, aliases: [...aliases], kind });
  }

  addProposition(
    proposition: Omit<KnowledgeProposition, "id"> & { id?: string },
  ): KnowledgeProposition {
    const signature = JSON.stringify([
      proposition.subjectId,
      proposition.predicate,
      proposition.object,
      proposition.qualifiers ?? {},
      proposition.source,
    ]);
    const existingId = this.propositionSignatures.get(signature);
    const existing = existingId ? this.propositions.get(existingId) : undefined;
    if (existing) return existing;

    this.propositionSequence += 1;
    const completed: KnowledgeProposition = {
      ...proposition,
      id: proposition.id ?? `dv7-p${String(this.propositionSequence).padStart(5, "0")}`,
    };
    this.propositions.set(completed.id, completed);
    this.propositionSignatures.set(signature, completed.id);
    const subjectEntries = this.bySubject.get(completed.subjectId) ?? [];
    subjectEntries.push(completed);
    this.bySubject.set(completed.subjectId, subjectEntries);
    const key = `${completed.subjectId}\u0000${completed.predicate}`;
    const predicateEntries = this.bySubjectPredicate.get(key) ?? [];
    predicateEntries.push(completed);
    this.bySubjectPredicate.set(key, predicateEntries);
    return completed;
  }

  finalize(): this {
    this.aliasEntries.length = 0;
    this.aliasEntries.push(
      ...[...this.aliases.entries()].sort((left, right) => {
        if (right[0].length !== left[0].length) return right[0].length - left[0].length;
        return left[0].localeCompare(right[0]);
      }),
    );
    return this;
  }

  entity(entityId: string): KnowledgeEntity | undefined {
    return this.entities.get(entityId);
  }

  allEntities(): KnowledgeEntity[] {
    return [...this.entities.values()];
  }

  allPropositions(): KnowledgeProposition[] {
    return [...this.propositions.values()];
  }

  direct(subjectId: string, predicate?: SemanticRelation): KnowledgeProposition[] {
    if (!predicate) return [...(this.bySubject.get(subjectId) ?? [])];
    return [...(this.bySubjectPredicate.get(`${subjectId}\u0000${predicate}`) ?? [])];
  }

  inverseObject(
    predicate: SemanticRelation,
    entityId: string,
  ): KnowledgeProposition[] {
    return [...this.propositions.values()].filter(
      (proposition) =>
        proposition.predicate === predicate &&
        proposition.object.kind === "entity" &&
        proposition.object.entityId === entityId,
    );
  }

  resolveExact(value: string): SemanticEntityMention | undefined {
    const normalized = normalizeAlias(value);
    const entityId = this.aliases.get(normalized);
    const entity = entityId ? this.entities.get(entityId) : undefined;
    if (!entity) return undefined;
    return {
      entityId: entity.id,
      canonicalName: entity.name,
      alias: normalized,
      start: 0,
      end: normalized.length,
    };
  }

  resolveId(entityId: string): SemanticEntityMention | undefined {
    const entity = this.entities.get(entityId);
    if (!entity) return undefined;
    return {
      entityId: entity.id,
      canonicalName: entity.name,
      alias: normalizeAlias(entity.name),
      start: 0,
      end: entity.name.length,
    };
  }

  findMentions(value: string): SemanticEntityMention[] {
    const normalized = normalizeText(value);
    const occupied: Array<[number, number]> = [];
    const mentions: SemanticEntityMention[] = [];

    for (const [alias, entityId] of this.aliasEntries) {
      if (alias.length === 1 && normalized !== alias) continue;
      const expression = new RegExp(
        `(?:^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|\\s|'s\\b|s'\\b)`,
        "g",
      );
      let match: RegExpExecArray | null;
      while ((match = expression.exec(normalized))) {
        const leadingSpace = match[0].startsWith(" ") ? 1 : 0;
        const start = match.index + leadingSpace;
        const end = start + alias.length;
        if (occupied.some(([left, right]) => start < right && end > left)) continue;
        const entity = this.entities.get(entityId);
        if (!entity) continue;
        occupied.push([start, end]);
        mentions.push({
          entityId,
          canonicalName: entity.name,
          alias,
          start,
          end,
        });
      }
    }

    return mentions.sort((left, right) => left.start - right.start);
  }

  stats() {
    return {
      entities: this.entities.size,
      aliases: this.aliases.size,
      propositions: this.propositions.size,
    };
  }
}

function addSeed(graph: KnowledgeGraph, seed: KnowledgeEntitySeed) {
  const entity = graph.ensureEntity(
    seed.name,
    seed.kind,
    seed.aliases ?? [],
    seed.id,
  );
  for (const [predicate, fact] of Object.entries(seed.facts)) {
    if (!fact) continue;
    for (const entry of factEntries(fact)) {
      const converted = propositionValue(entry);
      graph.addProposition({
        subjectId: entity.id,
        predicate: predicate as SemanticRelation,
        ...converted,
        source: "curated-dv7",
      });
    }
  }
}

function addExtendedPackTopics(graph: KnowledgeGraph) {
  for (const topic of knowledgeTopics) {
    const entity = graph.ensureEntity(
      topic.term,
      topic.category === "everyday" ? "concept" : "field",
      topic.aliases,
      `topic-${topic.id}`,
    );
    const values: Array<[SemanticRelation, string | readonly string[] | undefined]> = [
      ["definition", topic.definition],
      ["purpose", topic.purpose],
      ["mechanism", topic.mechanism],
      ["importance", topic.importance],
      ["example", topic.example],
      ["component", topic.components],
      ["related_to", topic.related],
    ];
    for (const [predicate, value] of values) {
      if (!value || (Array.isArray(value) && value.length === 0)) continue;
      const object: PropositionValue = Array.isArray(value)
        ? { kind: "list", values: [...value] }
        : { kind: "text", value: String(value) };
      graph.addProposition({
        subjectId: entity.id,
        predicate,
        object,
        source: "extended-pack",
      });
    }
  }
}

function addDerivedCapitalKnowledge(graph: KnowledgeGraph) {
  const capitalFacts = graph
    .allPropositions()
    .filter(
      (proposition) =>
        proposition.predicate === "capital" &&
        proposition.object.kind === "text",
    );

  for (const capitalFact of capitalFacts) {
    if (capitalFact.object.kind !== "text") continue;
    const country = graph.entity(capitalFact.subjectId);
    const capitalName = capitalFact.object.value
      .split(/\s+is\s+the\s+|\s*\(/)[0]
      .trim();
    if (
      !country ||
      !capitalName ||
      capitalName.includes(",") ||
      /\band\b/i.test(capitalName)
    ) {
      continue;
    }

    const city = graph.ensureEntity(
      capitalName,
      "place",
      [`${capitalName} city`],
      `city-${normalizeAlias(capitalName).replace(/\s+/g, "-")}`,
    );
    graph.addProposition({
      subjectId: city.id,
      predicate: "definition",
      object: { kind: "text", value: `the capital city of ${country.name}` },
      source: "derived",
    });
    graph.addProposition({
      subjectId: city.id,
      predicate: "country",
      object: { kind: "entity", entityId: country.id },
      source: "derived",
    });
    for (const continent of graph.direct(country.id, "continent")) {
      graph.addProposition({
        subjectId: city.id,
        predicate: "continent",
        object: continent.object,
        qualifiers: continent.qualifiers,
        source: "derived",
      });
    }
  }
}

export function buildKnowledgeGraph(): KnowledgeGraph {
  const graph = new KnowledgeGraph();
  for (const seed of [
    ...coreKnowledgeSeeds,
    ...everydayKnowledgeSeeds,
    ...scienceKnowledgeSeeds,
    ...worldAndPeopleKnowledgeSeeds,
  ]) {
    addSeed(graph, seed);
  }
  addExtendedPackTopics(graph);
  addDerivedCapitalKnowledge(graph);
  return graph.finalize();
}

export const lexiKnowledgeGraph = buildKnowledgeGraph();
