import type { SemanticRelation } from "@/modules/semantic/types";

export type PredicateDefinition = {
  id: SemanticRelation;
  label: string;
  inheritable?: boolean;
  transitive?: boolean;
  inverse?: SemanticRelation;
  benchmarkable?: boolean;
};

export const predicateDefinitions: readonly PredicateDefinition[] = [
  { id: "definition", label: "definition", benchmarkable: true },
  { id: "is_a", label: "classification", transitive: true, benchmarkable: true },
  { id: "purpose", label: "purpose", benchmarkable: true },
  { id: "mechanism", label: "mechanism", benchmarkable: true },
  { id: "importance", label: "importance", benchmarkable: true },
  { id: "example", label: "example", benchmarkable: true },
  { id: "component", label: "component", inverse: "part_of", benchmarkable: true },
  { id: "related_to", label: "relationship", benchmarkable: true },
  { id: "location", label: "location", benchmarkable: true },
  { id: "habitat", label: "habitat", inheritable: true, benchmarkable: true },
  { id: "capital", label: "capital", benchmarkable: true },
  { id: "continent", label: "continent", benchmarkable: true },
  { id: "country", label: "country", benchmarkable: true },
  { id: "language", label: "language", benchmarkable: true },
  { id: "currency", label: "currency", benchmarkable: true },
  { id: "color", label: "color", inheritable: true, benchmarkable: true },
  { id: "composition", label: "composition", inheritable: true, benchmarkable: true },
  { id: "diet", label: "diet", inheritable: true, benchmarkable: true },
  { id: "leg_count", label: "leg count", inheritable: true, benchmarkable: true },
  { id: "lifespan", label: "lifespan", benchmarkable: true },
  { id: "size", label: "size", benchmarkable: true },
  { id: "temperature", label: "temperature", benchmarkable: true },
  { id: "symbol", label: "symbol", benchmarkable: true },
  { id: "atomic_number", label: "atomic number", benchmarkable: true },
  { id: "invented_by", label: "inventor", benchmarkable: true },
  { id: "discovered_by", label: "discoverer", benchmarkable: true },
  { id: "created_by", label: "creator", benchmarkable: true },
  { id: "written_by", label: "author", benchmarkable: true },
  { id: "known_for", label: "known contribution", benchmarkable: true },
  { id: "founded_by", label: "founder", benchmarkable: true },
  { id: "founded_year", label: "founding year", benchmarkable: true },
  { id: "birth_year", label: "birth year", benchmarkable: true },
  { id: "nationality", label: "nationality", benchmarkable: true },
  { id: "formula", label: "formula", benchmarkable: true },
  { id: "unit", label: "unit", benchmarkable: true },
  { id: "year", label: "year", benchmarkable: true },
  { id: "cause", label: "cause", benchmarkable: true },
  { id: "effect", label: "effect", benchmarkable: true },
  { id: "function", label: "function", inheritable: true, benchmarkable: true },
  { id: "ability", label: "ability", inheritable: true, benchmarkable: true },
  { id: "has_part", label: "part", inverse: "part_of", inheritable: true, benchmarkable: true },
  { id: "part_of", label: "whole", inverse: "has_part", transitive: true, benchmarkable: true },
  { id: "contains", label: "contents", benchmarkable: true },
  { id: "produces", label: "product", benchmarkable: true },
  { id: "requires", label: "requirement", benchmarkable: true },
  { id: "used_by", label: "user", benchmarkable: true },
  { id: "classification", label: "classification" },
  { id: "comparison", label: "comparison" },
  { id: "user_name", label: "user name" },
  { id: "user_age", label: "user age" },
  { id: "user_location", label: "user location" },
  { id: "user_preference", label: "user preference" },
  { id: "previous_subject", label: "previous subject" },
  { id: "previous_question", label: "previous question" },
] as const;

export const predicateById = new Map(
  predicateDefinitions.map((predicate) => [predicate.id, predicate]),
);
