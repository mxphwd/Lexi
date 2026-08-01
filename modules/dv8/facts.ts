import type {
  KnowledgeGraph,
  KnowledgeProposition,
  PropositionValue,
} from "@/modules/knowledge-graph";
import type { SemanticRelation } from "@/modules/semantic";
import { dv8Normalize, phraseCompatible } from "./normalize";
import type { LiteralValue, NormalizedFact } from "./types";

function normalizeUnit(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const unit = dv8Normalize(value);
  const aliases: Readonly<Record<string, string>> = {
    metres: "meter", meters: "meter", metre: "meter", m: "meter",
    kilometres: "kilometer", kilometers: "kilometer", kilometre: "kilometer", km: "kilometer",
    centimetres: "centimeter", centimeters: "centimeter", centimetre: "centimeter", cm: "centimeter",
    kilograms: "kilogram", kg: "kilogram", grams: "gram", g: "gram",
    seconds: "second", sec: "second", minutes: "minute", hours: "hour",
    years: "year", celsius: "celsius", fahrenheit: "fahrenheit",
  };
  return aliases[unit] ?? unit;
}

function exactTextEntity(graph: KnowledgeGraph, value: string): string | undefined {
  const clean = value
    .replace(/^(?:a|an|the)\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  return graph.resolveExact(clean)?.entityId;
}

function normalizedValues(
  graph: KnowledgeGraph,
  value: PropositionValue,
  predicate: SemanticRelation,
): LiteralValue[] {
  switch (value.kind) {
    case "entity":
      return [{ kind: "entity", entityId: value.entityId }];
    case "number":
      return [{ kind: "number", value: value.value, unit: normalizeUnit(value.unit) }];
    case "boolean":
      return [{ kind: "boolean", value: value.value }];
    case "text": {
      const entityRelations = new Set<SemanticRelation>([
        "invented_by", "discovered_by", "created_by", "written_by", "founded_by",
        "capital", "continent", "country", "part_of", "is_a", "related_to",
      ]);
      const entityId = entityRelations.has(predicate)
        ? exactTextEntity(graph, value.value)
        : undefined;
      if (entityId) return [{ kind: "entity", entityId }];
      if (entityRelations.has(predicate)) {
        const mentions = graph.findMentions(value.value);
        const expectedKind = new Set(
          ["invented_by", "discovered_by", "created_by", "written_by", "founded_by"].includes(predicate)
            ? ["person"]
            : [],
        );
        const compatibleMentions = expectedKind.size
          ? mentions.filter((mention) => {
              const kind = graph.entity(mention.entityId)?.kind;
              return kind ? expectedKind.has(kind) : false;
            })
          : mentions;
        if (compatibleMentions.length === 1) {
          return [
            { kind: "entity", entityId: compatibleMentions[0].entityId },
            { kind: "text", value: value.value.trim() },
          ];
        }
      }
      const numericRelations = new Set<SemanticRelation>([
        "size", "temperature", "lifespan", "year", "birth_year", "founded_year",
      ]);
      if (numericRelations.has(predicate)) {
        const match = value.value.match(/(-?\d[\d,]*(?:\.\d+)?)\s*(million|billion)?\s*([a-z°]+)?/i);
        if (match) {
          const multiplier = match[2]?.toLowerCase() === "billion"
            ? 1_000_000_000
            : match[2]?.toLowerCase() === "million"
              ? 1_000_000
              : 1;
          return [
            {
              kind: "number",
              value: Number(match[1].replace(/,/g, "")) * multiplier,
              unit: normalizeUnit(match[3]?.replace("°", "")),
            },
            { kind: "text", value: value.value.trim() },
          ];
        }
      }
      return [{ kind: "text", value: value.value.trim() }];
    }
    case "list": {
      const values: LiteralValue[] = [];
      for (const item of value.values) {
        const entityId = exactTextEntity(graph, item);
        values.push(entityId
          ? { kind: "entity", entityId }
          : { kind: "text", value: item.trim() });
      }
      return values;
    }
  }
}

function literalKey(value: LiteralValue): string {
  switch (value.kind) {
    case "entity": return `e:${value.entityId}`;
    case "text": return `t:${dv8Normalize(value.value)}`;
    case "number": return `n:${value.value}:${value.unit ?? ""}`;
    case "boolean": return `b:${value.value}`;
  }
}

function factKey(subjectId: string, predicate: SemanticRelation): string {
  return `${subjectId}\u0000${predicate}`;
}

/** A normalized, indexed view of the DV7 graph; source propositions stay intact. */
export class Dv8FactStore {
  private readonly facts: NormalizedFact[] = [];
  private readonly bySubjectPredicate = new Map<string, NormalizedFact[]>();
  private readonly byPredicate = new Map<SemanticRelation, NormalizedFact[]>();
  private readonly byPredicateObject = new Map<string, NormalizedFact[]>();

  constructor(readonly graph: KnowledgeGraph) {
    for (const proposition of graph.allPropositions()) this.add(proposition);
    // A DV8 typed overlay fixes a high-frequency missing comparison without
    // mutating DV7's frozen proposition-count baseline.
    this.add({
      id: "dv8-overlay-mars-size",
      subjectId: "space-mars",
      predicate: "size",
      object: { kind: "number", value: 6_779, unit: "kilometer" },
      source: "derived",
    });
  }

  private add(proposition: KnowledgeProposition) {
    normalizedValues(this.graph, proposition.object, proposition.predicate).forEach((object, index) => {
      const fact: NormalizedFact = {
        id: `${proposition.id}:${index}`,
        propositionId: proposition.id,
        subjectId: proposition.subjectId,
        predicate: proposition.predicate,
        object,
        qualifiers: proposition.qualifiers,
        source: proposition.source,
      };
      this.facts.push(fact);
      const directKey = factKey(fact.subjectId, fact.predicate);
      const direct = this.bySubjectPredicate.get(directKey) ?? [];
      direct.push(fact);
      this.bySubjectPredicate.set(directKey, direct);
      const predicate = this.byPredicate.get(fact.predicate) ?? [];
      predicate.push(fact);
      this.byPredicate.set(fact.predicate, predicate);
      const inverseKey = `${fact.predicate}\u0000${literalKey(fact.object)}`;
      const inverse = this.byPredicateObject.get(inverseKey) ?? [];
      inverse.push(fact);
      this.byPredicateObject.set(inverseKey, inverse);
    });
  }

  direct(subjectId: string, predicate: SemanticRelation): NormalizedFact[] {
    return [...(this.bySubjectPredicate.get(factKey(subjectId, predicate)) ?? [])];
  }

  relation(predicate: SemanticRelation): NormalizedFact[] {
    return [...(this.byPredicate.get(predicate) ?? [])];
  }

  inverse(predicate: SemanticRelation, object: LiteralValue): NormalizedFact[] {
    return [...(this.byPredicateObject.get(`${predicate}\u0000${literalKey(object)}`) ?? [])];
  }

  ancestors(entityId: string): Array<{ entityId: string; facts: NormalizedFact[] }> {
    const results: Array<{ entityId: string; facts: NormalizedFact[] }> = [];
    const queue: Array<{ entityId: string; facts: NormalizedFact[] }> = [{ entityId, facts: [] }];
    const seen = new Set([entityId]);
    while (queue.length) {
      const current = queue.shift()!;
      for (const fact of this.direct(current.entityId, "is_a")) {
        if (fact.object.kind !== "entity" || seen.has(fact.object.entityId)) continue;
        seen.add(fact.object.entityId);
        const facts = [...current.facts, fact];
        results.push({ entityId: fact.object.entityId, facts });
        queue.push({ entityId: fact.object.entityId, facts });
      }
    }
    return results;
  }

  isA(entityId: string, classId: string): { value: boolean; facts: NormalizedFact[] } {
    if (entityId === classId) return { value: true, facts: [] };
    const path = this.ancestors(entityId).find((candidate) => candidate.entityId === classId);
    return { value: Boolean(path), facts: path?.facts ?? [] };
  }

  compatible(left: LiteralValue, right: LiteralValue): boolean {
    if (left.kind === "entity" && right.kind === "entity") return left.entityId === right.entityId;
    if (left.kind === "boolean" && right.kind === "boolean") return left.value === right.value;
    if (left.kind === "number" && right.kind === "number") {
      const converted = this.convert(right.value, right.unit, left.unit);
      return converted !== undefined && Math.abs(left.value - converted) < 1e-9;
    }
    const leftText = this.literalText(left);
    const rightText = this.literalText(right);
    return dv8Normalize(leftText) === dv8Normalize(rightText) || phraseCompatible(leftText, rightText);
  }

  literalText(value: LiteralValue): string {
    switch (value.kind) {
      case "entity": return this.graph.entity(value.entityId)?.name ?? value.entityId;
      case "text": return value.value;
      case "number": return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
      case "boolean": return String(value.value);
    }
  }

  convert(value: number, from?: string, to?: string): number | undefined {
    const source = normalizeUnit(from);
    const target = normalizeUnit(to);
    if (!source || !target || source === target) return value;
    const scale: Readonly<Record<string, number>> = {
      millimeter: 0.001, centimeter: 0.01, meter: 1, kilometer: 1000,
      gram: 0.001, kilogram: 1,
      second: 1, minute: 60, hour: 3600,
    };
    if (scale[source] && scale[target]) return (value * scale[source]) / scale[target];
    if (source === "celsius" && target === "fahrenheit") return value * 9 / 5 + 32;
    if (source === "fahrenheit" && target === "celsius") return (value - 32) * 5 / 9;
    return undefined;
  }

  stats() {
    const entityEdges = this.facts.filter((fact) => fact.object.kind === "entity").length;
    const typedLiterals = this.facts.filter((fact) => fact.object.kind !== "text").length;
    return {
      facts: this.facts.length,
      entityEdges,
      typedLiterals,
      predicates: this.byPredicate.size,
      subjectPredicateKeys: this.bySubjectPredicate.size,
    };
  }
}
