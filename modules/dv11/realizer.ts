import { dv11KnowledgeStore, type Dv11KnowledgeStore } from "./store";
import type { Dv11ClausePlan, Dv11ClauseResult, Dv11ExecutionResult, Dv11Proposition, Dv11Value } from "./types";

function entityName(id: string, store: Dv11KnowledgeStore) {
  return store.entity(id)?.canonicalName ?? id.replace(/^(?:legacy|dv10|entity):/, "").replace(/-/g, " ");
}

function join(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function formatNumber(value: number, significantFigures?: number) {
  if (significantFigures && value !== 0) return Number(value.toPrecision(significantFigures)).toLocaleString("en-US");
  return Number.isInteger(value) ? value.toLocaleString("en-US") : Number(value.toFixed(10)).toLocaleString("en-US");
}

function formatUnit(unit: string, value: number) {
  if (Math.abs(value) === 1) return unit;
  if (/^(?:%|m|km|cm|mm|kg|g|mg|s|min|h|k|°c|°f|mph|km\/h)$/i.test(unit)) return unit;
  if (/(?:s|x|z|ch|sh)$/i.test(unit)) return unit;
  if (/[^a-z-]/i.test(unit)) return unit;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
}

function valueText(value: Dv11Value, store: Dv11KnowledgeStore): string {
  if (value.kind === "entity") return entityName(value.entityId, store);
  if (value.kind === "text" || value.kind === "date") return value.value;
  if (value.kind === "number") return formatNumber(value.value);
  if (value.kind === "quantity") return `${value.quantity.uncertainty ? "about " : ""}${formatNumber(value.quantity.value, value.quantity.significantFigures)}${value.quantity.unit ? ` ${formatUnit(value.quantity.unit, value.quantity.value)}` : ""}`;
  if (value.kind === "boolean") return value.value ? "true" : "false";
  if (value.kind === "interval") return value.from && value.to ? `from ${value.from} to ${value.to}` : value.from ? `from ${value.from}` : `until ${value.to}`;
  return join(value.values.map((item) => valueText(item, store)));
}

function relationSentence(proposition: Dv11Proposition, value: string, store: Dv11KnowledgeStore) {
  if (proposition.subjectId === "session:user") {
    if (proposition.relation === "user_name") return `Your name is ${value}`;
    if (proposition.relation === "user_age") return `You are ${value} years old`;
    if (proposition.relation === "user_location") return `You live in ${value}`;
    if (proposition.relation === "user_preference") return `You like ${value}`;
  }
  const subject = entityName(proposition.subjectId, store);
  const closestTarget = proposition.qualifiers.scope?.match(/target (?:is|=) (?:the )?([^;]+)/i)?.[1];
  const frames: Record<string, string> = {
    definition: `${subject} is ${value}`,
    is_a: `${subject} is ${/^(?:a|an)\b/i.test(value) ? "" : /^[aeiou]/i.test(value) ? "an " : "a "}${value}`,
    purpose: `${subject} is used to ${value}`,
    mechanism: `${subject} works by ${value}`,
    importance: `${subject} is important because ${value}`,
    example: `An example of ${subject} is ${value}`,
    component: `${subject} includes ${value}`,
    has_part: `${subject} includes ${value}`,
    part_of: `${subject} is part of ${value}`,
    location: `${subject} is located ${value}`,
    habitat: `${subject} lives in ${value}`,
    capital: `${value} is the capital of ${subject}`,
    continent: `${subject} is in ${value}`,
    country: `${subject} is in ${value}`,
    currency: `${subject} uses ${value}`,
    language: `${value} is spoken in ${subject}`,
    composition: `${subject} is made of ${value}`,
    diet: `${subject} eats ${value}`,
    invented_by: `${subject} was invented by ${value}`,
    created_by: `${subject} was created by ${value}`,
    written_by: `${subject} was written by ${value}`,
    discovered_by: `${subject} was discovered by ${value}`,
    founded_by: `${subject} was founded by ${value}`,
    founded_year: `${subject} was founded in ${value}`,
    birth_year: `${subject} was born in ${value}`,
    known_for: `${subject} is known for ${value}`,
    formula: `The formula for ${subject} is ${value}`,
    symbol: `The symbol for ${subject} is ${value}`,
    atomic_number: `${subject} has atomic number ${value}`,
    leg_count: `${subject} has ${value} leg${value === "1" ? "" : "s"}`,
    size: `${subject} has a recorded size of ${value}`,
    temperature: `${subject} has a recorded temperature of ${value}`,
    average_distance: `${subject} has a recorded average distance of ${value}`,
    borders: `${subject} borders ${value}`,
    state_transition: `${subject}: ${value}`,
    origin: `${subject}: ${value}`,
    interesting_fact: value,
    procedure: `To prepare ${subject}: ${value}`,
    closest_to: `${value} is the closest recorded ${subject}${closestTarget ? ` to ${closestTarget}` : ""}`,
  };
  return frames[proposition.relation] ?? `${subject}'s ${String(proposition.relation).replace(/_/g, " ")} is ${value}`;
}

function realizeSupported(plan: Dv11ClausePlan, result: Dv11ClauseResult, store: Dv11KnowledgeStore) {
  if (plan.operation === "calculate" && result.aggregate) return valueText(result.aggregate, store);
  if (result.answerShape === "proof") {
    if (!result.proof.length) return "The previous answer has no attached proof.";
    const proof = result.proof.map((step, index) => `${index + 1}. ${step.explanation}`).join(" ");
    const sources = [...new Set(result.propositions.flatMap((proposition) => proposition.provenance.map((source) => source.title ?? `${source.sourceId} (${source.sourceLocation})`)))];
    return `${proof}${sources.length ? ` Source${sources.length === 1 ? "" : "s"}: ${join(sources)}.` : ""}`;
  }
  if (result.answerShape === "boolean" && result.verdict !== undefined) return result.verdict ? "Yes." : "No.";
  if (result.aggregate) {
    const value = valueText(result.aggregate, store);
    if (plan.operation === "aggregate") {
      const noun = plan.source.text.match(/^how many\s+(.+?)(?:\s+(?:are|is|do|does|were|was|in|on|at)\b|\?|$)/i)?.[1]
        ?.replace(/\bthere$/, "").trim();
      if (noun) return `There are ${value} ${noun}.`;
    }
    return value;
  }
  const answerValues = plan.answerVariable
    ? result.bindings.flatMap((binding) => binding[plan.answerVariable!] ? [binding[plan.answerVariable!]] : [])
    : [];
  const distinctValues = [...new Map(answerValues.map((value) => [JSON.stringify(value), value])).values()];
  if (distinctValues.length) {
    const rendered = distinctValues.map((value) => valueText(value, store));
    if (result.status === "insufficient") {
      return `I can prove ${result.returnedCount ?? rendered.length} of the requested ${result.requestedCount}: ${join(rendered)}. I do not have enough compatible propositions to supply the remainder.`;
    }
    if (result.answerShape === "entities") return join(rendered);
    if (rendered.length === 1) {
      const proposition = result.propositions[0];
      return proposition ? `${relationSentence(proposition, rendered[0], store)}.` : `${rendered[0]}.`;
    }
    return `${join(rendered)}.`;
  }
  if (result.propositions.length) {
    return result.propositions.map((proposition) => `${relationSentence(proposition, valueText(proposition.object, store), store)}.`).join(" ");
  }
  return result.reason ?? "The requested result is supported.";
}

function realizeClause(plan: Dv11ClausePlan, result: Dv11ClauseResult, store: Dv11KnowledgeStore) {
  if (result.text) return result.text;
  if (result.status === "supported" || result.status === "contradicted" || result.status === "insufficient") return realizeSupported(plan, result, store);
  if (result.status === "ambiguous") return `I need clarification before I can answer this part: ${result.reason ?? "more than one compatible interpretation remains"}`;
  if (result.status === "canceled") return "The request was canceled.";
  if (result.status === "error") return "The request could not be completed because the deterministic execution path failed.";
  const relation = plan.patterns[0]?.relation;
  if (relation?.startsWith("property:")) {
    const property = relation.slice("property:".length).replace(/_/g, " ");
    return `I recognize the subject, but “${property}” does not map to a supported typed relation. Name the exact property you want.`;
  }
  return `I do not have a subject-compatible proposition or rule for this part${result.reason ? `: ${result.reason}` : "."}`;
}

export function realizeDv11Result(result: Dv11ExecutionResult, store: Dv11KnowledgeStore = dv11KnowledgeStore) {
  const parts = result.clauses.map((clause, index) => ({ index, text: realizeClause(result.plan.clauses[index], clause, store), status: clause.status }));
  const text = parts.length === 1
    ? parts[0].text
    : parts.map((part, index) => `${index + 1}. ${part.text}`).join(" ");
  return { text, parts };
}
