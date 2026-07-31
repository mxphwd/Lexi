import type { AnswerStyle } from "@/modules/extended-pack/linguistic-features";
import type { KnowledgeGraph } from "@/modules/knowledge-graph";
import type {
  GraphAnswer,
  KnowledgeEntity,
  KnowledgeProposition,
  PropositionValue,
} from "@/modules/knowledge-graph";
import { relationLabels, type SemanticQuery } from "@/modules/semantic";

export type RealizedPropositionAnswer = {
  text: string;
  structureId: string;
  evidence: string[];
};

function sentence(value: string): string {
  const trimmed = value.trim().replace(/[.!?]+$/, "");
  return trimmed ? `${trimmed}.` : "";
}

function capitalized(value: string): string {
  return value ? value[0].toLocaleUpperCase("en-US") + value.slice(1) : value;
}

function entityName(graph: KnowledgeGraph, entityId: string): string {
  return graph.entity(entityId)?.name ?? entityId;
}

function valueText(graph: KnowledgeGraph, value: PropositionValue): string {
  switch (value.kind) {
    case "entity":
      return entityName(graph, value.entityId);
    case "text":
      return value.value;
    case "number":
      return `${value.value}${value.unit ? ` ${value.unit}` : ""}`;
    case "boolean":
      return value.value ? "yes" : "no";
    case "list":
      if (value.values.length === 0) return "nothing recorded";
      if (value.values.length === 1) return value.values[0];
      return `${value.values.slice(0, -1).join(", ")}, and ${value.values.at(-1)}`;
  }
}

function qualifierText(proposition: KnowledgeProposition): string {
  const qualifiers = [
    proposition.qualifiers?.scope,
    proposition.qualifiers?.condition
      ? `when ${proposition.qualifiers.condition}`
      : undefined,
    proposition.qualifiers?.time,
  ].filter(Boolean);
  return qualifiers.length ? ` (${qualifiers.join("; ")})` : "";
}

function relationSentence(
  graph: KnowledgeGraph,
  entity: KnowledgeEntity,
  proposition: KnowledgeProposition,
): string {
  const subject = capitalized(entity.name);
  const value = valueText(graph, proposition.object);
  const qualifier = qualifierText(proposition);

  switch (proposition.predicate) {
    case "definition":
      return sentence(`${subject} is ${value}`);
    case "is_a":
      return sentence(`${subject} is classified as ${value}`);
    case "purpose":
      return sentence(`${subject} is used to ${value}`);
    case "mechanism":
      return sentence(`At a basic level, ${value}`);
    case "importance":
      return sentence(`${subject} matters because ${value}`);
    case "example":
      return sentence(`An example involving ${entity.name} is ${value}`);
    case "component":
    case "has_part":
      return sentence(`The recorded parts of ${entity.name} are ${value}`);
    case "related_to":
      return sentence(`${subject} is related to ${value}`);
    case "location":
      return sentence(`${subject} is located ${value}`);
    case "habitat":
      return sentence(`${subject} lives in ${value}`);
    case "capital":
      return sentence(`${capitalized(value)} is the capital of ${entity.name}`);
    case "continent":
      return sentence(`${subject} is in ${value}`);
    case "country":
      return sentence(`${subject} is in ${value}`);
    case "language":
      return sentence(`The recorded principal or official language for ${entity.name} is ${value}`);
    case "currency":
      return sentence(`${subject} uses ${value}`);
    case "color":
      return sentence(`${subject} is ${value}`);
    case "composition":
      return sentence(`${subject} is composed of ${value}`);
    case "diet":
      return sentence(`${subject} eats ${value}`);
    case "leg_count":
      return sentence(`${subject} has ${value} legs${qualifier}`);
    case "lifespan":
      return sentence(`${subject} typically lives ${value}${qualifier}`);
    case "size":
      return sentence(`${subject}'s recorded size is ${value}${qualifier}`);
    case "temperature":
      return sentence(`${subject}'s recorded temperature is ${value}${qualifier}`);
    case "symbol":
      return sentence(`The symbol for ${entity.name} is ${value}`);
    case "atomic_number":
      return sentence(`${subject} has atomic number ${value}`);
    case "invented_by":
      if (
        /\bis widely credited\b/i.test(value) ||
        /^many inventors\b/i.test(value)
      ) {
        return sentence(
          `${subject}'s invention history is recorded as follows: ${value}`,
        );
      }
      return sentence(`${subject} was invented by ${value}`);
    case "discovered_by":
      return sentence(`${subject} was discovered by ${value}`);
    case "created_by":
      return sentence(`${subject} was created by ${value}`);
    case "written_by":
      return sentence(`${subject} was written by ${value}`);
    case "known_for":
      return sentence(`${subject} is known for ${value}`);
    case "founded_by":
      return sentence(`${subject} was founded by ${value}`);
    case "founded_year":
      return sentence(`${subject} was founded in ${value}${qualifier}`);
    case "birth_year":
      return sentence(`${subject} was born in ${value}${qualifier}`);
    case "nationality":
      return sentence(`${subject}'s recorded nationality is ${value}`);
    case "formula":
      return sentence(`The recorded formula for ${entity.name} is ${value}`);
    case "unit":
      return sentence(`${subject} is measured in ${value}`);
    case "year":
      return sentence(`The recorded year for ${entity.name} is ${value}${qualifier}`);
    case "cause":
      return sentence(`${subject} occurs or originated because ${value}`);
    case "effect":
      return sentence(`${subject} can result in ${value}`);
    case "function":
      return sentence(`${subject}'s function is ${value}`);
    case "ability": {
      const action = proposition.qualifiers?.scope ?? "perform the recorded action";
      if (proposition.object.kind === "boolean") {
        return sentence(`${subject} ${proposition.object.value ? "can" : "cannot"} ${action}`);
      }
      return sentence(`${subject}'s recorded ability is ${value}${qualifier}`);
    }
    case "part_of":
      return sentence(`${subject} is part of ${value}`);
    case "contains":
      return sentence(`${subject} contains ${value}`);
    case "produces":
      return sentence(`${subject} produces ${value}${qualifier}`);
    case "requires":
      return sentence(`${subject} requires ${value}${qualifier}`);
    case "used_by":
      return sentence(`${subject} is used by ${value}`);
    default:
      return sentence(`${subject}'s ${relationLabels[proposition.predicate]} is ${value}`);
  }
}

function comparativeText(
  graph: KnowledgeGraph,
  query: SemanticQuery,
  answer: GraphAnswer,
): string {
  const [leftId, rightId] = answer.comparedSubjectIds ?? [
    query.subjectId!,
    query.objectId!,
  ];
  const left = graph.entity(leftId)!;
  const right = graph.entity(rightId)!;
  const leftFacts = answer.propositions.filter((item) => item.subjectId === leftId);
  const rightFacts = answer.propositions.filter((item) => item.subjectId === rightId);
  const relation = answer.relation ?? query.relation;
  const leftValue = leftFacts[0]?.object;
  const rightValue = rightFacts[0]?.object;

  if (
    leftValue?.kind === "number" &&
    rightValue?.kind === "number" &&
    leftValue.unit === rightValue.unit
  ) {
    const comparison =
      leftValue.value === rightValue.value
        ? "the same"
        : leftValue.value > rightValue.value
          ? `${left.name} has the larger value`
          : `${right.name} has the larger value`;
    return `${capitalized(left.name)} has ${leftValue.value}${leftValue.unit ? ` ${leftValue.unit}` : ""}, while ${right.name} has ${rightValue.value}${rightValue.unit ? ` ${rightValue.unit}` : ""}; ${comparison}.`;
  }

  const leftText = leftValue ? valueText(graph, leftValue) : "no recorded value";
  const rightText = rightValue ? valueText(graph, rightValue) : "no recorded value";
  return `${capitalized(left.name)} has the recorded ${relationLabels[relation]} “${leftText},” while ${right.name} has “${rightText}.”`;
}

function applyStyle(
  text: string,
  style: AnswerStyle | undefined,
  answer: GraphAnswer,
): string {
  if (!style || style === "plain" || style === "brief") return text;
  if (style === "simple") return `In simple terms, ${text[0].toLocaleLowerCase("en-US")}${text.slice(1)}`;
  if (style === "stepwise") {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences
      .map((item, index) => `${index + 1}. ${item}`)
      .join(" ");
  }
  if (style === "technical") {
    return `${text} This answer is assembled from ${answer.propositions.length} typed proposition${answer.propositions.length === 1 ? "" : "s"} and ${answer.proof.length} explicit proof step${answer.proof.length === 1 ? "" : "s"}.`;
  }
  if (style === "detailed" || style === "balanced") {
    return `${text} The statement is limited to the recorded scope and qualifiers of the knowledge graph.`;
  }
  if (style === "exampled" || style === "practical" || style === "analogy") {
    return text;
  }
  return text;
}

export function realizeGraphAnswer(
  graph: KnowledgeGraph,
  query: SemanticQuery,
  answer: GraphAnswer,
): RealizedPropositionAnswer {
  const subject = query.subjectId ? graph.entity(query.subjectId) : undefined;
  const object = query.objectId ? graph.entity(query.objectId) : undefined;

  let text: string;
  if (query.kind === "comparison" && answer.comparedSubjectIds) {
    text = comparativeText(graph, query, answer);
  } else if (query.kind === "boolean" && query.relation === "is_a" && subject && object) {
    text = answer.verdict
      ? `Yes. ${capitalized(subject.name)} is classified as ${object.name} through the recorded classification path.`
      : `No recorded classification path connects ${subject.name} to ${object.name}.`;
  } else if (query.kind === "boolean" && subject) {
    const explanation = answer.propositions
      .map((proposition) => relationSentence(graph, subject, proposition))
      .join(" ");
    text = `${answer.verdict ? "Yes" : "No"}. ${explanation}`;
  } else if (subject) {
    text = answer.propositions
      .map((proposition) => relationSentence(graph, subject, proposition))
      .join(" ");
  } else {
    text = "I found propositions, but I could not resolve their subject.";
  }

  return {
    text: applyStyle(text, query.modifiers.style, answer),
    structureId: `dv7-proposition:${query.kind}:${answer.relation ?? query.relation}:${query.modifiers.style ?? "plain"}`,
    evidence: [
      ...answer.propositions.map((proposition) => proposition.id),
      ...answer.proof.map((step) => `rule:${step.rule}`),
    ],
  };
}
