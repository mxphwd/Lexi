import type { Dv8FactStore } from "./facts";
import type { ExecutionResult, LiteralValue, QueryPlan } from "./types";

function capitalize(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function list(values: string[]) {
  const unique = [...new Set(values)];
  if (unique.length <= 1) return unique[0] ?? "nothing recorded";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique.at(-1)}`;
}

function literal(store: Dv8FactStore, value: LiteralValue) {
  return store.literalText(value);
}

function subjectName(plan: QueryPlan, store: Dv8FactStore, index = 0) {
  const id = plan.subjectIds[index];
  return id ? store.graph.entity(id)?.name ?? id : "the subject";
}

function lookupText(plan: QueryPlan, result: ExecutionResult, store: Dv8FactStore) {
  const relation = plan.patterns[0]?.predicate;
  const answerVariable = plan.answerVariable ?? "answer";
  let values = result.bindings.map((binding) => binding[answerVariable]).filter(Boolean);
  const entityPreferred = new Set(["invented_by", "discovered_by", "created_by", "written_by", "founded_by", "capital", "country", "continent"]);
  if (entityPreferred.has(relation)) {
    const entities = values.filter((value) => value.kind === "entity");
    if (entities.length) values = entities;
  }
  const rendered = list(values.map((value) => literal(store, value)));
  const subject = subjectName(plan, store);
  switch (relation) {
    case "definition": return `${capitalize(subject)} is ${rendered}.`;
    case "is_a": return `${capitalize(subject)} is classified as ${rendered}.`;
    case "purpose": case "function": return `${capitalize(subject)} is used to ${rendered}.`;
    case "mechanism": return `${capitalize(subject)} works through this recorded mechanism: ${rendered}.`;
    case "importance": return `${capitalize(subject)} matters because ${rendered}.`;
    case "example": return `A recorded example involving ${subject} is ${rendered}.`;
    case "component": case "has_part": return `${capitalize(subject)} has these recorded parts: ${rendered}.`;
    case "related_to": return `${capitalize(subject)} is related to ${rendered}.`;
    case "location": return `${capitalize(subject)} is located ${rendered}.`;
    case "habitat": return `${capitalize(subject)} is found in ${rendered}.`;
    case "capital": return `${capitalize(rendered)} is the capital of ${subject}.`;
    case "continent": return `${capitalize(subject)} is in ${rendered}.`;
    case "country": return `${capitalize(subject)} is in ${rendered}.`;
    case "language": return `${capitalize(subject)} has ${rendered} recorded as its principal or official language information.`;
    case "currency": return `${capitalize(subject)} uses ${rendered}.`;
    case "color": return `${capitalize(subject)} is ${rendered}.`;
    case "composition": return `${capitalize(subject)} is composed of ${rendered}.`;
    case "diet": return `${capitalize(subject)} eats ${rendered}.`;
    case "leg_count": return `${capitalize(subject)} has ${rendered} legs.`;
    case "lifespan": return `${capitalize(subject)} has a recorded lifespan of ${rendered}.`;
    case "size": return `${capitalize(subject)} has a recorded size of ${rendered}.`;
    case "temperature": return `${capitalize(subject)} has a recorded temperature of ${rendered}.`;
    case "symbol": return `The symbol for ${subject} is ${rendered}.`;
    case "atomic_number": return `${capitalize(subject)} has atomic number ${rendered}.`;
    case "invented_by": return `${capitalize(subject)} is associated with ${rendered} in its recorded invention history.`;
    case "discovered_by": return `${capitalize(subject)} was discovered by ${rendered}.`;
    case "created_by": return `${capitalize(subject)} was created by ${rendered}.`;
    case "written_by": return `${capitalize(subject)} was written by ${rendered}.`;
    case "known_for": return `${capitalize(subject)} is known for ${rendered}.`;
    case "founded_by": return `${capitalize(subject)} was founded by ${rendered}.`;
    case "founded_year": return `${capitalize(subject)} was founded in ${rendered}.`;
    case "birth_year": return `${capitalize(subject)} was born in ${rendered}.`;
    case "nationality": return `${capitalize(subject)} has ${rendered} recorded as nationality information.`;
    case "formula": return `The recorded formula for ${subject} is ${rendered}.`;
    case "unit": return `${capitalize(subject)} is measured in ${rendered}.`;
    case "year": return `The recorded year for ${subject} is ${rendered}.`;
    case "cause": return `${capitalize(subject)} occurs or originated because ${rendered}.`;
    case "effect": return `${capitalize(subject)} can result in ${rendered}.`;
    case "ability": return `${capitalize(subject)} has the recorded ability to ${rendered}.`;
    case "part_of": return `${capitalize(subject)} is part of ${rendered}.`;
    case "contains": return `${capitalize(subject)} contains ${rendered}.`;
    case "produces": return `${capitalize(subject)} produces ${rendered}.`;
    case "requires": return `${capitalize(subject)} requires ${rendered}.`;
    default: return `${capitalize(subject)} has the recorded ${relation} value ${rendered}.`;
  }
}

function selectText(plan: QueryPlan, result: ExecutionResult, store: Dv8FactStore) {
  const variable = plan.answerVariable ?? "answer";
  let values = result.bindings.map((binding) => binding[variable]).filter(Boolean);
  if (["invented_by", "discovered_by", "created_by", "written_by", "founded_by"].includes(plan.patterns[0]?.predicate)) {
    const entities = values.filter((value) => value.kind === "entity");
    if (entities.length) values = entities;
  }
  return `The matching recorded ${values.length === 1 ? "answer is" : "answers are"} ${list(values.map((value) => literal(store, value)))}.`;
}

function askText(plan: QueryPlan, result: ExecutionResult, store: Dv8FactStore) {
  const subject = subjectName(plan, store);
  const relation = plan.patterns[0]?.predicate;
  const requested = plan.patterns[0]?.object;
  const requestedText = requested?.kind === "text"
    ? requested.value.replace(/^(?:not|never)\s+/, "")
    : requested?.kind === "entity"
      ? store.graph.entity(requested.entityId)?.name ?? requested.entityId
      : requested?.kind === "number"
        ? `${requested.value}${requested.unit && relation !== "leg_count" ? ` ${requested.unit}` : ""}`
        : relation;
  if (result.verdict === undefined) {
    const condition = result.facts.find((fact) => fact.qualifiers?.condition)?.qualifiers?.condition;
    return condition
      ? `${capitalize(subject)} has that recorded relationship only when ${condition}; the question did not establish that condition.`
      : `I found related facts for ${subject}, but they do not establish a yes or no answer.`;
  }
  const prefix = result.verdict ? "Yes" : "No";
  if (plan.quantifier) {
    const action = requestedText ?? relation;
    if (plan.quantifier === "all") {
      return result.verdict
        ? `Yes. Every recorded ${subject} member satisfies ${action}.`
        : `No. Not every recorded ${subject} member satisfies ${action}.`;
    }
    if (plan.quantifier === "any") {
      return result.verdict
        ? `Yes. At least one recorded ${subject} member satisfies ${action}.`
        : `No recorded ${subject} member satisfies ${action}.`;
    }
    return result.verdict
      ? `Yes. No recorded ${subject} member satisfies ${action}.`
      : `No. At least one recorded ${subject} member satisfies ${action}.`;
  }
  if (relation === "is_a") return `${prefix}. ${capitalize(subject)} ${result.verdict ? "is" : "is not"} classified as ${requestedText}.`;
  if (relation === "ability") {
    const actionSupported = plan.negated ? !result.verdict : result.verdict;
    return `${prefix}. ${capitalize(subject)} ${actionSupported ? "can" : "cannot"} ${requestedText}.`;
  }
  if (relation === "leg_count") return `${prefix}. ${capitalize(subject)} ${result.verdict ? "has" : "does not have"} ${requestedText} legs.`;
  return `${prefix}. The recorded facts ${result.verdict ? "support" : "do not support"} that ${subject} ${relation?.replace(/_/g, " ")} ${requestedText}.`;
}

function compareText(plan: QueryPlan, result: ExecutionResult, store: Dv8FactStore) {
  const comparison = result.comparison!;
  const leftSubject = subjectName(plan, store, 0);
  const rightSubject = subjectName(plan, store, 1);
  const left = literal(store, comparison.left);
  const right = literal(store, comparison.right);
  if (comparison.left.kind !== "number" || comparison.right.kind !== "number") {
    const relation = plan.patterns[0]?.predicate?.replace(/_/g, " ") ?? "property";
    return `${capitalize(leftSubject)} has the recorded ${relation} “${left},” while ${rightSubject} has “${right}.”`;
  }
  if (comparison.equal) return `${capitalize(leftSubject)} and ${rightSubject} have the same recorded value: ${left}.`;
  const larger = comparison.winner === "left" ? leftSubject : rightSubject;
  const requested = plan.comparator === "less"
    ? comparison.winner === "left" ? rightSubject : leftSubject
    : larger;
  return `${capitalize(leftSubject)} has ${left}, while ${rightSubject} has ${right}; ${requested} has the ${plan.comparator === "less" ? "smaller" : "larger"} value.`;
}

function style(text: string, plan: QueryPlan, result: ExecutionResult) {
  if (plan.style === "simple") return `In simple terms, ${text[0].toLowerCase()}${text.slice(1)}`;
  if (plan.style === "technical") return `${text} This result used ${result.facts.length} normalized fact${result.facts.length === 1 ? "" : "s"} through ${result.proof.length} inspectable execution step${result.proof.length === 1 ? "" : "s"}.`;
  if (plan.style === "stepwise") return result.proof.map((proof, index) => `${index + 1}. ${proof.explanation}`).join(" ") + ` ${text}`;
  if (plan.style === "brief") return text.split(/(?<=[.!?])\s+/)[0];
  return text;
}

export function realizeExecution(plan: QueryPlan, result: ExecutionResult, store: Dv8FactStore) {
  if (result.status !== "answered") {
    const subject = subjectName(plan, store);
    const relation = plan.patterns[0]?.predicate?.replace(/_/g, " ");
    return relation
      ? `I recognize ${subject}, but I do not have a subject-compatible recorded ${relation} fact that satisfies this question.`
      : "I could not form one unambiguous typed question plan. Please name the subject and the property you want.";
  }
  let text: string;
  if (plan.operation === "compare") text = compareText(plan, result, store);
  else if (plan.operation === "ask") text = askText(plan, result, store);
  else if (plan.operation === "aggregate") text = `The recorded count is ${result.aggregateValue}.`;
  else if (plan.operation === "select") text = selectText(plan, result, store);
  else text = lookupText(plan, result, store);
  if ((plan.style === "practical" || plan.style === "exampled") && plan.subjectIds[0]) {
    const example = store.direct(plan.subjectIds[0], "example")[0];
    if (example) text += ` ${plan.style === "practical" ? "A practical example" : "An example"} is ${store.literalText(example.object)}.`;
  }
  return style(text, plan, result);
}
