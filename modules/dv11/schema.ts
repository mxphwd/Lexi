import { predicateDefinitions } from "@/modules/knowledge-graph";
import type { Dv11PredicateSchema, Dv11Relation } from "./types";

const entityRanges = new Set([
  "is_a", "part_of", "has_part", "component", "country", "continent",
  "created_by", "invented_by", "discovered_by", "written_by", "founded_by",
  "used_by", "related_to",
]);

const numericRelations = new Map<string, string | undefined>([
  ["leg_count", "count"],
  ["atomic_number", "count"],
  ["birth_year", "year"],
  ["founded_year", "year"],
  ["year", "year"],
  ["size", "length"],
  ["temperature", "temperature"],
  ["average_distance", "length"],
  ["count", "count"],
]);

const functionalRelations = new Set([
  "capital", "currency", "symbol", "atomic_number", "birth_year",
  "founded_year", "leg_count", "formula",
]);

const closedWorldRelations = new Set([
  "leg_count", "atomic_number", "symbol", "birth_year", "founded_year",
]);

const temporalRelations = new Set([
  "capital", "currency", "language", "location", "year", "birth_year",
  "founded_year", "origin",
]);

export const dv11PredicateSchemas = new Map<Dv11Relation, Dv11PredicateSchema>();

for (const definition of predicateDefinitions) {
  const numericDimension = numericRelations.get(definition.id);
  dv11PredicateSchemas.set(definition.id, {
    id: definition.id,
    label: definition.label,
    domain: [],
    range: numericDimension !== undefined
      ? ["number", "quantity", "text"]
      : entityRanges.has(definition.id)
        ? ["entity", "text", "ordered-list", "set"]
        : ["text", "entity", "number", "quantity", "boolean", "ordered-list", "set"],
    cardinality: functionalRelations.has(definition.id) ? "one" : "many",
    functional: functionalRelations.has(definition.id),
    symmetric: definition.id === "related_to" || definition.id === "comparison",
    inverse: definition.inverse,
    transitive: Boolean(definition.transitive),
    inheritable: Boolean(definition.inheritable),
    unitDimension: numericDimension,
    temporalBehavior: temporalRelations.has(definition.id) ? "versioned" : "timeless",
    worldAssumption: closedWorldRelations.has(definition.id) ? "closed" : "open",
  });
}

const additional: Dv11PredicateSchema[] = [
  { id: "count", label: "count", domain: [], range: ["number"], cardinality: "one", functional: true, symmetric: false, transitive: false, inheritable: false, unitDimension: "count", temporalBehavior: "versioned", worldAssumption: "closed" },
  { id: "member", label: "member", domain: [], range: ["entity"], cardinality: "many", functional: false, symmetric: false, inverse: "is_a", transitive: false, inheritable: false, temporalBehavior: "versioned", worldAssumption: "open" },
  { id: "closest_to", label: "closest to", domain: [], range: ["entity"], cardinality: "many", functional: false, symmetric: false, temporalBehavior: "versioned", transitive: false, inheritable: false, worldAssumption: "open" },
  { id: "average_distance", label: "average distance", domain: [], range: ["number", "quantity"], cardinality: "many", functional: false, symmetric: true, unitDimension: "length", temporalBehavior: "versioned", transitive: false, inheritable: false, worldAssumption: "open" },
  { id: "borders", label: "borders", domain: ["country", "region"], range: ["entity", "set", "ordered-list"], cardinality: "many", functional: false, symmetric: true, temporalBehavior: "versioned", transitive: false, inheritable: false, worldAssumption: "open" },
  { id: "state_transition", label: "state transition", domain: ["material", "process", "concept"], range: ["text", "entity"], cardinality: "many", functional: false, symmetric: false, temporalBehavior: "timeless", transitive: false, inheritable: true, worldAssumption: "open" },
  { id: "origin", label: "origin", domain: [], range: ["text", "entity", "date", "interval"], cardinality: "many", functional: false, symmetric: false, temporalBehavior: "versioned", transitive: false, inheritable: false, worldAssumption: "open" },
  { id: "interesting_fact", label: "interesting fact", domain: [], range: ["text"], cardinality: "many", functional: false, symmetric: false, temporalBehavior: "timeless", transitive: false, inheritable: false, worldAssumption: "open" },
  { id: "procedure", label: "procedure", domain: [], range: ["ordered-list"], cardinality: "many", functional: false, symmetric: false, temporalBehavior: "timeless", transitive: false, inheritable: true, worldAssumption: "open" },
];

for (const schema of additional) dv11PredicateSchemas.set(schema.id, schema);

export function registerDv11PredicateSchema(schema: Dv11PredicateSchema) {
  const existing = dv11PredicateSchemas.get(schema.id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(schema)) {
    throw new Error(`Predicate schema conflict for ${schema.id}.`);
  }
  dv11PredicateSchemas.set(schema.id, schema);
}

export function dv11PredicateSchema(relation: Dv11Relation) {
  return dv11PredicateSchemas.get(relation);
}

type UnitDefinition = { dimension: string; scale: number; offset?: number; canonical: string };

const units = new Map<string, UnitDefinition>([
  ["m", { dimension: "length", scale: 1, canonical: "meter" }],
  ["meter", { dimension: "length", scale: 1, canonical: "meter" }],
  ["meters", { dimension: "length", scale: 1, canonical: "meter" }],
  ["km", { dimension: "length", scale: 1_000, canonical: "meter" }],
  ["kilometer", { dimension: "length", scale: 1_000, canonical: "meter" }],
  ["kilometers", { dimension: "length", scale: 1_000, canonical: "meter" }],
  ["cm", { dimension: "length", scale: 0.01, canonical: "meter" }],
  ["millimeter", { dimension: "length", scale: 0.001, canonical: "meter" }],
  ["mi", { dimension: "length", scale: 1609.344, canonical: "meter" }],
  ["mile", { dimension: "length", scale: 1609.344, canonical: "meter" }],
  ["miles", { dimension: "length", scale: 1609.344, canonical: "meter" }],
  ["kg", { dimension: "mass", scale: 1, canonical: "kilogram" }],
  ["kilogram", { dimension: "mass", scale: 1, canonical: "kilogram" }],
  ["g", { dimension: "mass", scale: 0.001, canonical: "kilogram" }],
  ["lb", { dimension: "mass", scale: 0.45359237, canonical: "kilogram" }],
  ["second", { dimension: "time", scale: 1, canonical: "second" }],
  ["minute", { dimension: "time", scale: 60, canonical: "second" }],
  ["hour", { dimension: "time", scale: 3600, canonical: "second" }],
  ["day", { dimension: "time", scale: 86400, canonical: "second" }],
  ["c", { dimension: "temperature", scale: 1, offset: 273.15, canonical: "kelvin" }],
  ["°c", { dimension: "temperature", scale: 1, offset: 273.15, canonical: "kelvin" }],
  ["celsius", { dimension: "temperature", scale: 1, offset: 273.15, canonical: "kelvin" }],
  ["k", { dimension: "temperature", scale: 1, offset: 0, canonical: "kelvin" }],
  ["kelvin", { dimension: "temperature", scale: 1, offset: 0, canonical: "kelvin" }],
  ["f", { dimension: "temperature-fahrenheit", scale: 5 / 9, offset: 255.372222, canonical: "kelvin" }],
  ["°f", { dimension: "temperature-fahrenheit", scale: 5 / 9, offset: 255.372222, canonical: "kelvin" }],
]);

export function normalizeDv11Quantity(value: number, unit?: string) {
  if (!unit) return { value, unit, dimension: undefined };
  const definition = units.get(unit.toLocaleLowerCase("en-US"));
  if (!definition) return undefined;
  return {
    value: value * definition.scale + (definition.offset ?? 0),
    unit: definition.canonical,
    dimension: definition.dimension === "temperature-fahrenheit" ? "temperature" : definition.dimension,
  };
}
