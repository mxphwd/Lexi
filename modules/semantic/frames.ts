import type { AnswerStyle } from "@/modules/extended-pack/linguistic-features";
import type { SemanticRelation } from "./types";

export type SemanticQuestionTemplate = {
  id: string;
  render: (subject: string, relation: string) => string;
};

export const semanticOpenQuestionTemplates: readonly SemanticQuestionTemplate[] = [
  { id: "what-property-of", render: (subject, relation) => `What is the ${relation} of ${subject}?` },
  { id: "what-possessive-property", render: (subject, relation) => `What is ${subject}'s ${relation}?` },
  { id: "tell-property", render: (subject, relation) => `Tell me the ${relation} of ${subject}.` },
  { id: "give-property", render: (subject, relation) => `Give me ${subject}'s ${relation}.` },
  { id: "can-tell-property", render: (subject, relation) => `Can you tell me the ${relation} of ${subject}?` },
  { id: "could-tell-property", render: (subject, relation) => `Could you tell me ${subject}'s ${relation}?` },
  { id: "explain-property", render: (subject, relation) => `Explain the ${relation} of ${subject}.` },
  { id: "identify-property", render: (subject, relation) => `Identify ${subject}'s ${relation}.` },
  { id: "property-question", render: (subject, relation) => `${subject} ${relation}?` },
  { id: "about-property", render: (subject, relation) => `What can you say about ${subject}'s ${relation}?` },
  { id: "know-property", render: (subject, relation) => `Do you know the ${relation} of ${subject}?` },
  { id: "state-property", render: (subject, relation) => `State the ${relation} of ${subject}.` },
] as const;

export const semanticBooleanQuestionTemplates: readonly SemanticQuestionTemplate[] = [
  { id: "is-property", render: (subject, relation) => `Is ${subject}'s ${relation} recorded?` },
  { id: "does-have-property", render: (subject, relation) => `Does ${subject} have a ${relation}?` },
  { id: "can-confirm-property", render: (subject, relation) => `Can you confirm ${subject}'s ${relation}?` },
  { id: "is-it-true-property", render: (subject, relation) => `Is it true that ${subject} has this ${relation}?` },
  { id: "confirm-property", render: (subject, relation) => `Confirm the ${relation} of ${subject}.` },
  { id: "verify-property", render: (subject, relation) => `Verify ${subject}'s ${relation}.` },
  { id: "known-property", render: (subject, relation) => `Is the ${relation} of ${subject} known?` },
  { id: "record-property", render: (subject, relation) => `Do you have ${subject}'s ${relation} recorded?` },
] as const;

const comparisonOpeners = [
  "Compare",
  "Please compare",
  "Can you compare",
  "Could you compare",
  "Would you compare",
  "Contrast",
  "Please contrast",
  "Show me a comparison of",
  "Give me a comparison of",
  "Explain the difference between",
] as const;

const comparisonRelationJoins = [
  "by",
  "in terms of",
  "with respect to",
  "based on",
  "using",
  "for their",
] as const;

/**
 * Sixty executable comparison forms: every opener is accepted by the semantic
 * parser, and every join introduces a recognized relation label.
 */
export const semanticComparisonQuestionTemplates = comparisonOpeners.flatMap(
  (opener, openerIndex) =>
    comparisonRelationJoins.map((join, joinIndex) => ({
      id: `comparison-${openerIndex + 1}-${joinIndex + 1}`,
      render: (left: string, right: string, relation: string) =>
        `${opener} ${left} and ${right} ${join} ${relation}.`,
    })),
);

export const semanticAnswerStyles: readonly AnswerStyle[] = [
  "plain",
  "brief",
  "simple",
  "detailed",
  "exampled",
  "stepwise",
  "technical",
  "practical",
  "analogy",
  "balanced",
] as const;

export const relationLabels: Readonly<Record<SemanticRelation, string>> = {
  definition: "definition",
  is_a: "classification",
  purpose: "purpose",
  mechanism: "mechanism",
  importance: "importance",
  example: "example",
  component: "components",
  related_to: "related concepts",
  location: "location",
  habitat: "habitat",
  capital: "capital",
  continent: "continent",
  country: "country",
  language: "language",
  currency: "currency",
  color: "color",
  composition: "composition",
  diet: "diet",
  leg_count: "leg count",
  lifespan: "lifespan",
  size: "size",
  temperature: "temperature",
  symbol: "symbol",
  atomic_number: "atomic number",
  invented_by: "inventor",
  discovered_by: "discoverer",
  created_by: "creator",
  written_by: "author",
  known_for: "known contribution",
  founded_by: "founder",
  founded_year: "founding year",
  birth_year: "birth year",
  nationality: "nationality",
  formula: "formula",
  unit: "unit",
  year: "year",
  cause: "cause",
  effect: "effect",
  function: "function",
  ability: "ability",
  has_part: "parts",
  part_of: "whole",
  contains: "contents",
  produces: "products",
  requires: "requirements",
  used_by: "users",
  classification: "classification",
  comparison: "recorded properties",
  user_name: "name",
  user_age: "age",
  user_location: "location",
  user_preference: "preference",
  previous_subject: "previous subject",
  previous_question: "previous question",
  previous_answer: "previous answer",
};

export function relationFromLabel(value: string): SemanticRelation | undefined {
  const normalized = value
    .trim()
    .replace(/\b(?:recorded|main|basic|known|current)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const entry = Object.entries(relationLabels).find(([, label]) => label === normalized);
  if (entry) return entry[0] as SemanticRelation;

  const aliases: Record<string, SemanticRelation> = {
    type: "is_a",
    kind: "is_a",
    category: "is_a",
    use: "purpose",
    role: "function",
    parts: "has_part",
    component: "component",
    "made of": "composition",
    material: "composition",
    lives: "habitat",
    "lives in": "habitat",
    food: "diet",
    eats: "diet",
    legs: "leg_count",
    lifetime: "lifespan",
    heat: "temperature",
    inventor: "invented_by",
    discoverer: "discovered_by",
    creator: "created_by",
    author: "written_by",
    writer: "written_by",
    "known for": "known_for",
    contribution: "known_for",
    founder: "founded_by",
    founded: "founded_year",
    "birth date": "birth_year",
    born: "birth_year",
    equation: "formula",
    measurement: "unit",
    origin: "cause",
    result: "effect",
    capabilities: "ability",
    needs: "requires",
  };
  return aliases[normalized];
}
