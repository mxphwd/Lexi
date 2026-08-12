import { dv11NormalizeText, dv11Number } from "./normalize";
import { dv11PredicateSchema, normalizeDv11Quantity } from "./schema";
import { dv11Rule } from "./rules";
import { dv11KnowledgeStore, type Dv11KnowledgeStore } from "./store";
import type {
  Dv11Binding,
  Dv11ClausePlan,
  Dv11ClauseResult,
  Dv11Condition,
  Dv11EngineOptions,
  Dv11ExecutionResult,
  Dv11Filter,
  Dv11Pattern,
  Dv11ProofStep,
  Dv11Proposition,
  Dv11QueryPlan,
  Dv11Term,
  Dv11Value,
} from "./types";

type ExecutionRow = { binding: Dv11Binding; propositions: Dv11Proposition[]; proof: Dv11ProofStep[] };

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("The request was canceled.", "AbortError");
}

function valueText(value: Dv11Value, store: Dv11KnowledgeStore): string {
  if (value.kind === "entity") return store.entity(value.entityId)?.canonicalName ?? value.entityId;
  if (value.kind === "text" || value.kind === "date") return value.value;
  if (value.kind === "number") return String(value.value);
  if (value.kind === "quantity") return `${value.quantity.value}${value.quantity.unit ? ` ${value.quantity.unit}` : ""}`;
  if (value.kind === "boolean") return String(value.value);
  if (value.kind === "interval") return `${value.from ?? ""}–${value.to ?? ""}`;
  return value.values.map((item) => valueText(item, store)).join("|");
}

function termValue(term: Dv11Term, binding: Dv11Binding): Dv11Value | undefined {
  return term.kind === "variable" ? binding[term.name] : term;
}

function normalizedQuantity(value: Dv11Value) {
  if (value.kind === "number") return { value: value.value, dimension: undefined, unit: undefined, tolerance: 0 };
  if (value.kind !== "quantity") return undefined;
  const normalized = normalizeDv11Quantity(value.quantity.value, value.quantity.unit);
  if (!normalized) return undefined;
  return { ...normalized, tolerance: value.quantity.tolerance ?? value.quantity.uncertainty ?? 0 };
}

function compatible(left: Dv11Value, right: Dv11Value, store: Dv11KnowledgeStore): boolean {
  if (left.kind === "entity" && right.kind === "entity") return left.entityId === right.entityId;
  const leftQuantity = normalizedQuantity(left);
  const rightQuantity = normalizedQuantity(right);
  if (leftQuantity && rightQuantity) {
    if (leftQuantity.dimension && rightQuantity.dimension && leftQuantity.dimension !== rightQuantity.dimension) return false;
    const tolerance = Math.max(leftQuantity.tolerance, rightQuantity.tolerance, Math.abs(leftQuantity.value) * 1e-9, 1e-9);
    return Math.abs(leftQuantity.value - rightQuantity.value) <= tolerance;
  }
  if (left.kind === "boolean" && right.kind === "boolean") return left.value === right.value;
  if (left.kind === "date" && right.kind === "date") return left.value === right.value;
  if (left.kind === "interval" && right.kind === "interval") return left.from === right.from && left.to === right.to;
  if ((left.kind === "ordered-list" || left.kind === "set") && (right.kind === "ordered-list" || right.kind === "set")) {
    const leftValues = left.values.map((value) => valueText(value, store));
    const rightValues = right.values.map((value) => valueText(value, store));
    if (left.kind === "ordered-list" && right.kind === "ordered-list") return JSON.stringify(leftValues) === JSON.stringify(rightValues);
    return leftValues.length === rightValues.length && leftValues.every((value) => rightValues.includes(value));
  }
  return dv11NormalizeText(valueText(left, store)) === dv11NormalizeText(valueText(right, store));
}

function bind(term: Dv11Term, value: Dv11Value, binding: Dv11Binding, store: Dv11KnowledgeStore): Dv11Binding | undefined {
  if (term.kind !== "variable") return compatible(term, value, store) ? binding : undefined;
  if (term.expectedKind && term.expectedKind !== "any" && term.expectedKind !== value.kind) return undefined;
  const existing = binding[term.name];
  if (existing && !compatible(existing, value, store)) return undefined;
  return existing ? binding : { ...binding, [term.name]: value };
}

function allValues(value: Dv11Value): Dv11Value[] {
  return value.kind === "ordered-list" || value.kind === "set" ? value.values : [value];
}

function ancestors(store: Dv11KnowledgeStore, entityId: string) {
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: Dv11Proposition[] }> = [{ id: entityId, path: [] }];
  const results: Array<{ id: string; path: Dv11Proposition[] }> = [];
  while (queue.length) {
    const current = queue.shift()!;
    for (const fact of store.direct(current.id, "is_a")) {
      if (fact.object.kind !== "entity" || visited.has(fact.object.entityId)) continue;
      visited.add(fact.object.entityId);
      const path = [...current.path, fact];
      results.push({ id: fact.object.entityId, path });
      queue.push({ id: fact.object.entityId, path });
    }
  }
  return results;
}

function candidates(pattern: Dv11Pattern, binding: Dv11Binding, store: Dv11KnowledgeStore) {
  const subject = termValue(pattern.subject, binding);
  const object = termValue(pattern.object, binding);
  const schema = dv11PredicateSchema(pattern.relation);
  const rows: Array<{ proposition: Dv11Proposition; prefixProof: Dv11ProofStep[] }> = [];
  if (subject?.kind === "entity") {
    for (const proposition of store.direct(subject.entityId, pattern.relation)) rows.push({ proposition, prefixProof: [] });
    if (schema?.transitive) {
      const visited = new Set([subject.entityId]);
      const queue: Array<{ id: string; path: Dv11Proposition[] }> = store.direct(subject.entityId, pattern.relation)
        .filter((fact) => fact.object.kind === "entity")
        .map((fact) => ({ id: fact.object.kind === "entity" ? fact.object.entityId : "", path: [fact] }));
      while (queue.length) {
        const current = queue.shift()!;
        if (!current.id || visited.has(current.id)) continue;
        visited.add(current.id);
        if (current.path.length > 1) {
          const final = current.path.at(-1)!;
          rows.push({
            proposition: { ...final, id: `derived:transitive:${pattern.relation}:${subject.entityId}:${current.id}`, subjectId: subject.entityId, object: { kind: "entity", entityId: current.id }, provenance: final.provenance.map((source) => ({ ...source, extractionMethod: "mechanically-derived", reviewStatus: "mechanically-derived", confidence: Math.min(source.confidence, 0.82) })) },
            prefixProof: [{ id: `proof:transitive:${pattern.relation}:${subject.entityId}:${current.id}`, ruleId: dv11Rule("transitive").id, premiseIds: current.path.map((fact) => fact.id), conclusion: `${subject.entityId} ${pattern.relation} ${current.id}`, explanation: `Applied the declared transitive ${pattern.relation} schema across ${current.path.length} indexed edges.` }],
          });
        }
        if (current.path.length >= 8) continue;
        for (const next of store.direct(current.id, pattern.relation)) if (next.object.kind === "entity" && !visited.has(next.object.entityId)) queue.push({ id: next.object.entityId, path: [...current.path, next] });
      }
    }
    if (schema?.inheritable) {
      for (const ancestor of ancestors(store, subject.entityId)) {
        for (const proposition of store.direct(ancestor.id, pattern.relation)) {
          rows.push({ proposition: { ...proposition, subjectId: subject.entityId }, prefixProof: [{ id: `proof:inherit:${proposition.id}`, ruleId: dv11Rule("inheritance").id, premiseIds: [...ancestor.path.map((item) => item.id), proposition.id], conclusion: `${subject.entityId} ${pattern.relation}`, explanation: `Inherited ${pattern.relation} through ${ancestor.path.length} explicit classification edge${ancestor.path.length === 1 ? "" : "s"}.` }] });
        }
      }
    }
  } else if (object) {
    for (const proposition of store.inverse(pattern.relation, object)) rows.push({ proposition, prefixProof: [] });
    if (schema?.inverse) {
      const reversedObject = pattern.subject.kind === "variable" ? object : termValue(pattern.subject, binding);
      if (reversedObject) {
        for (const proposition of store.inverse(schema.inverse, reversedObject)) {
          rows.push({ proposition, prefixProof: [{ id: `proof:inverse:${proposition.id}`, ruleId: dv11Rule("inverse").id, premiseIds: [proposition.id], explanation: `Applied the declared inverse relation ${schema.inverse} ↔ ${pattern.relation}.` }] });
        }
      }
    }
  } else {
    for (const proposition of store.relation(pattern.relation)) rows.push({ proposition, prefixProof: [] });
  }
  return rows;
}

function conditionText(condition: Dv11Condition): string {
  if (condition.kind === "counterfactual") return condition.premiseText;
  if (condition.kind === "proposition") return `${condition.pattern.relation}`;
  if (condition.kind === "not") return `not ${conditionText(condition.operand)}`;
  if (condition.kind === "if") return `${conditionText(condition.premise)} ${conditionText(condition.consequence)}`;
  return condition.operands.map(conditionText).join(` ${condition.kind} `);
}

function conditionCompatible(plan: Dv11ClausePlan, proposition: Dv11Proposition, store: Dv11KnowledgeStore) {
  const requested = [
    ...plan.filters
    .filter((filter): filter is Extract<Dv11Filter, { kind: "condition" }> => filter.kind === "condition")
    .map((filter) => dv11NormalizeText(conditionText(filter.expression)).replace(/^target:/, "")),
    ...plan.conditions.map((condition) => dv11NormalizeText(condition.kind === "if" ? conditionText(condition.premise) : conditionText(condition))),
  ];
  if (!requested.length) return true;
  const expandedRequested = requested.flatMap((needle) => {
    const entity = store.entity(needle);
    return entity ? [needle, dv11NormalizeText(entity.canonicalName), ...entity.aliases.map(dv11NormalizeText)] : [needle];
  });
  const recorded = [
    proposition.qualifiers.scope,
    proposition.qualifiers.condition ? conditionText(proposition.qualifiers.condition) : undefined,
  ].filter((item): item is string => Boolean(item)).map(dv11NormalizeText);
  return requested.every((needle) => {
    const entity = store.entity(needle);
    const forms = entity ? [needle, dv11NormalizeText(entity.canonicalName), ...entity.aliases.map(dv11NormalizeText)] : expandedRequested.filter((form) => form === needle);
    return forms.some((form) => recorded.some((value) => value.includes(form) || form.includes(value)));
  });
}

function temporalCompatible(plan: Dv11ClausePlan, proposition: Dv11Proposition, now: Date) {
  if (!plan.temporal.length) return true;
  const recorded = proposition.qualifiers.temporal;
  const provenanceValid = proposition.provenance.some((source) => (!source.validFrom || source.validFrom <= now.toISOString()) && (!source.validTo || source.validTo >= now.toISOString()));
  return plan.temporal.every((requested) => {
    if (requested.kind === "current") return provenanceValid && (!recorded || recorded.kind === "current" || recorded.kind === "interval");
    if (!recorded) return dv11PredicateSchema(proposition.relation)?.temporalBehavior === "timeless";
    const requestedYear = Number(requested.value ?? requested.from);
    const recordedFrom = Number(recorded.value ?? recorded.from);
    const recordedTo = Number(recorded.to ?? recorded.value ?? recorded.from);
    if (!Number.isFinite(requestedYear) || !Number.isFinite(recordedFrom) || !Number.isFinite(recordedTo)) return dv11NormalizeText(JSON.stringify(recorded)).includes(dv11NormalizeText(requested.value ?? ""));
    if (requested.kind === "before") return recordedFrom < requestedYear;
    if (requested.kind === "after") return recordedTo > requestedYear;
    return requestedYear >= recordedFrom && requestedYear <= recordedTo;
  });
}

function applyPattern(rows: ExecutionRow[], pattern: Dv11Pattern, plan: Dv11ClausePlan, store: Dv11KnowledgeStore, now: Date, signal?: AbortSignal) {
  const output: ExecutionRow[] = [];
  for (const row of rows) {
    throwIfAborted(signal);
    for (const candidate of candidates(pattern, row.binding, store)) {
      const proposition = candidate.proposition;
      if (!conditionCompatible(plan, proposition, store) || !temporalCompatible(plan, proposition, now)) continue;
      const binding = bind(pattern.subject, { kind: "entity", entityId: proposition.subjectId }, row.binding, store);
      if (!binding) continue;
      const objectValues = allValues(proposition.object);
      for (const object of objectValues) {
        const bound = bind(pattern.object, object, binding, store);
        if (!bound) continue;
        output.push({
          binding: bound,
          propositions: [...row.propositions, proposition],
          proof: [...row.proof, ...candidate.prefixProof, { id: `proof:direct:${proposition.id}`, ruleId: candidate.prefixProof.length ? "join" : "direct-index", premiseIds: [proposition.id], conclusion: `${proposition.subjectId} ${proposition.relation}`, explanation: `Matched ${proposition.id} through the subject, relation, object, qualifier, and temporal indexes.` }],
        });
      }
    }
  }
  if (pattern.optional && !output.length) return rows;
  return output;
}

function compareValues(left: Dv11Value, right: Dv11Value, store: Dv11KnowledgeStore) {
  const leftQuantity = normalizedQuantity(left);
  const rightQuantity = normalizedQuantity(right);
  if (leftQuantity && rightQuantity && (!leftQuantity.dimension || !rightQuantity.dimension || leftQuantity.dimension === rightQuantity.dimension)) {
    const tolerance = Math.max(leftQuantity.tolerance, rightQuantity.tolerance, Math.abs(leftQuantity.value) * 1e-9, 1e-9);
    const delta = leftQuantity.value - rightQuantity.value;
    return Math.abs(delta) <= tolerance ? 0 : delta < 0 ? -1 : 1;
  }
  const leftText = valueText(left, store);
  const rightText = valueText(right, store);
  return leftText.localeCompare(rightText, "en-US", { numeric: true, sensitivity: "base" });
}

function conditionSatisfied(condition: Dv11Condition, row: ExecutionRow, store: Dv11KnowledgeStore): boolean {
  if (condition.kind === "counterfactual") {
    const requested = dv11NormalizeText(condition.premiseText).replace(/^target:/, "");
    const entity = store.entity(requested);
    const requestedForms = entity ? [requested, dv11NormalizeText(entity.canonicalName), ...entity.aliases.map(dv11NormalizeText)] : [requested];
    return row.propositions.some((proposition) => {
      const recorded = [proposition.qualifiers.scope, proposition.qualifiers.condition ? conditionText(proposition.qualifiers.condition) : undefined]
        .filter((value): value is string => Boolean(value)).map(dv11NormalizeText);
      if (condition.premiseText.startsWith("target:")) return requestedForms.some((form) => recorded.some((value) => value.includes(form) || form.includes(value)));
      return recorded.some((value) => value.includes(requested)) || row.proof.some((proof) => dv11NormalizeText(proof.explanation).includes(requested));
    });
  }
  if (condition.kind === "proposition") {
    return row.propositions.some((proposition) => proposition.relation === condition.pattern.relation
      && Boolean(bind(condition.pattern.subject, { kind: "entity", entityId: proposition.subjectId }, row.binding, store))
      && allValues(proposition.object).some((object) => Boolean(bind(condition.pattern.object, object, row.binding, store))));
  }
  if (condition.kind === "not") return !conditionSatisfied(condition.operand, row, store);
  if ("operands" in condition) return condition.kind === "and"
    ? condition.operands.every((operand) => conditionSatisfied(operand, row, store))
    : condition.operands.some((operand) => conditionSatisfied(operand, row, store));
  return conditionSatisfied(condition.premise, row, store) && conditionSatisfied(condition.consequence, row, store);
}

function filterRow(row: ExecutionRow, filter: Dv11Filter, store: Dv11KnowledgeStore): boolean {
  if (filter.kind === "condition") return conditionSatisfied(filter.expression, row, store);
  if (filter.kind === "compare") {
    const left = termValue(filter.left, row.binding);
    const right = termValue(filter.right, row.binding);
    if (!left || !right) return false;
    const comparison = compareValues(left, right, store);
    if (filter.operator === "eq") return comparison === 0;
    if (filter.operator === "ne") return comparison !== 0;
    if (filter.operator === "gt") return comparison > 0;
    if (filter.operator === "gte") return comparison >= 0;
    if (filter.operator === "lt") return comparison < 0;
    return comparison <= 0;
  }
  if (filter.kind === "contains") {
    const value = termValue(filter.value, row.binding);
    const found = value ? dv11NormalizeText(valueText(value, store)).includes(dv11NormalizeText(filter.needle)) : false;
    return filter.negated ? !found : found;
  }
  if (filter.kind === "membership") {
    const value = termValue(filter.value, row.binding);
    const set = termValue(filter.set, row.binding);
    const found = Boolean(value && set && (set.kind === "set" || set.kind === "ordered-list") && set.values.some((candidate) => compatible(candidate, value, store)));
    return filter.negated ? !found : found;
  }
  const value = termValue(filter.value, row.binding);
  if (value?.kind !== "entity") return false;
  const entity = store.entity(value.entityId);
  const found = filter.classId
    ? value.entityId === filter.classId || ancestors(store, value.entityId).some((ancestor) => ancestor.id === filter.classId)
    : filter.entityKind
      ? entity?.kind === filter.entityKind
      : false;
  return filter.negated ? !found : found;
}

function uniqueRows(rows: ExecutionRow[]) {
  return [...new Map(rows.map((row) => [JSON.stringify(row.binding), row])).values()];
}

function calculateExpression(text: string): { value?: number; proof: Dv11ProofStep[]; reason?: string } {
  const normalized = dv11NormalizeText(text);
  const numbers = [...normalized.matchAll(/[+-]?\d+(?:\.\d+)?|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/gu)]
    .map((match) => dv11Number(match[0])).filter((value): value is number => value !== undefined);
  let value: number | undefined;
  let ruleId = "arithmetic";
  if (/\bpercent of\b/.test(normalized) && numbers.length >= 2) { value = (numbers[0] / 100) * numbers[1]; ruleId = "percentage"; }
  else if (/\baverage(?: of)?\b/.test(normalized) && numbers.length) { value = numbers.reduce((sum, item) => sum + item, 0) / numbers.length; ruleId = "average"; }
  else if (/\b(?:buy|bought|get|got|receive|received)\b/.test(normalized) && numbers.length >= 2) { value = numbers[0] + numbers[1]; ruleId = "additive-state-transition"; }
  else if (/\b(?:lose|lost|use|used)\b/.test(normalized) && numbers.length >= 2) { value = numbers[0] - numbers[1]; ruleId = "subtractive-state-transition"; }
  else if (/\b(?:plus|add|sum)\b|\+/.test(normalized) && numbers.length >= 2) { value = numbers.reduce((sum, item) => sum + item, 0); ruleId = "addition"; }
  else if (/\b(?:minus|subtract|difference)\b|-/.test(normalized) && numbers.length >= 2) { value = numbers.slice(1).reduce((result, item) => result - item, numbers[0]); ruleId = "subtraction"; }
  else if (/\b(?:times|multiplied by|product)\b|\*/.test(normalized) && numbers.length >= 2) { value = numbers.reduce((result, item) => result * item, 1); ruleId = "multiplication"; }
  else if (/\b(?:divided by|quotient)\b|\//.test(normalized) && numbers.length >= 2 && numbers.slice(1).every((item) => item !== 0)) { value = numbers.slice(1).reduce((result, item) => result / item, numbers[0]); ruleId = "division"; }
  if (value === undefined || !Number.isFinite(value)) return { proof: [], reason: "The arithmetic expression is incomplete or unsupported." };
  return { value, proof: [{ id: `proof:${ruleId}`, ruleId, premiseIds: numbers.map(String), conclusion: String(value), explanation: `Applied deterministic ${ruleId} to ${numbers.join(", ")}.` }] };
}

function inferSyllogism(text: string) {
  const normalized = dv11NormalizeText(text);
  const matched = normalized.match(/^(?:if|suppose) (?:every|all) (.+?) (?:is|are) (?:an? )?(.+?) and (?:every|all) (.+?) (?:is|are) (?:an? )?(.+?)[,;]? (?:is|are) (?:every|all) (.+?) (?:an? )?(.+?)[?.!]*$/);
  if (!matched) return undefined;
  const [, firstSubject, firstObject, secondSubject, secondObject, askedSubject, askedObject] = matched.map((value) => value?.trim());
  const same = (left: string, right: string) => left.replace(/s$/, "") === right.replace(/s$/, "");
  const verdict = same(firstObject, secondSubject) && same(firstSubject, askedSubject) && same(secondObject, askedObject);
  return { verdict, proof: [{ id: "proof:categorical-syllogism", ruleId: dv11Rule("quantifier").id, premiseIds: [`all:${firstSubject}:${firstObject}`, `all:${secondSubject}:${secondObject}`], conclusion: `${askedSubject}:${askedObject}:${verdict}`, explanation: verdict ? `Composed the two universal class relations through their shared class “${firstObject}”.` : "The requested conclusion does not follow through the shared class in the supplied premises." }] satisfies Dv11ProofStep[] };
}

function emptyResult(plan: Dv11ClausePlan, status: Dv11ClauseResult["status"], reason: string): Dv11ClauseResult {
  const confidence = { ...plan.confidence, evidence: 0, proof: 0, realization: 0 };
  return { clauseId: plan.id, status, answerShape: plan.answerShape, bindings: [], propositions: [], proof: [], missingSlots: [...plan.unresolvedSlots], reason, confidence, calibratedConfidence: 0 };
}

function lexicalResult(plan: Dv11ClausePlan, store: Dv11KnowledgeStore): Dv11ClauseResult {
  const request = plan.lexicalRequest;
  if (!request) return emptyResult(plan, "error", "The lexical operation has no typed request.");
  const lexemes = store.resolveLexeme(request.term);
  if (!lexemes.length) return emptyResult(plan, "unknown", `No loaded lexical record matches “${request.term}”.`);
  if (lexemes.length > 1) return emptyResult(plan, "ambiguous", `More than one loaded lexeme matches “${request.term}”.`);
  const lexeme = lexemes[0];
  const senses = store.lexicalSensesFor(lexeme.id);
  let selectedIndex = request.requestedSense ?? 0;
  if (request.contextHint && senses.length) {
    const hints = new Set(dv11NormalizeText(request.contextHint).match(/[\p{L}\p{M}\p{N}]+/gu) ?? []);
    const ranked = senses.map((sense, index) => ({
      index,
      score: [...hints].filter((hint) => dv11NormalizeText(`${sense.partOfSpeech} ${sense.definition} ${sense.example ?? ""} ${sense.contextualFeatures.join(" ")}`).includes(hint)).length,
    })).sort((left, right) => right.score - left.score || left.index - right.index);
    selectedIndex = ranked[0]?.index ?? 0;
  }
  selectedIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, senses.length - 1));
  const selected = senses[selectedIndex];
  const selectedOnly = request.operation === "define" || request.operation === "example" || request.requestedSense !== undefined;
  const allClaims = store.lexicalClaimsFor(lexeme.id, selectedOnly ? selected?.id : undefined);
  const relation = request.operation === "define" || request.operation === "list-senses" ? "definition"
    : request.operation === "part-of-speech" ? "part-of-speech"
      : request.operation === "example" ? "usage-example"
        : request.operation === "related" ? "association"
          : request.operation === "provenance" ? "provenance"
            : undefined;
  const claims = relation === "provenance" || request.operation === "recall-topic"
    ? allClaims
    : allClaims.filter((claim) => claim.relation === relation);
  const title = lexeme.lemma ? lexeme.lemma[0].toLocaleUpperCase("en-US") + lexeme.lemma.slice(1) : lexeme.lemma;
  let text = "";
  if (request.operation === "define") text = selected
    ? `${title} means ${selected.definition.replace(/[.!?]+$/, "")} (${selected.partOfSpeech}).`
    : `I have a lexical record for “${lexeme.lemma}”, but it has no definition.`;
  else if (request.operation === "list-senses") {
    if (request.requestedSense !== undefined && selected) text = `Another recorded sense of ${lexeme.lemma} is: ${selected.definition.replace(/[.!?]+$/, "")} (${selected.partOfSpeech}).`;
    else text = senses.length
      ? `${lexeme.lemma} has ${senses.length} recorded ${senses.length === 1 ? "sense" : "senses"}: ${senses.slice(0, 6).map((sense, index) => `${index + 1}. ${sense.definition.replace(/[.!?]+$/, "")} (${sense.partOfSpeech}).`).join(" ")}${senses.length > 6 ? ` ${senses.length - 6} more senses are recorded.` : ""}`
      : `I have no recorded lexical senses for “${lexeme.lemma}”.`;
  } else if (request.operation === "part-of-speech") {
    const parts = [...new Set(senses.map((sense) => sense.partOfSpeech).filter(Boolean))];
    text = parts.length ? `${title} is recorded as ${parts.join(", ")}.` : `The loaded lexical record does not include a part of speech for “${lexeme.lemma}”.`;
  } else if (request.operation === "example") {
    const example = selected?.example ?? senses.find((sense) => sense.example)?.example;
    text = example ? `Recorded example: “${example.replace(/[.!?]+$/, "")}.”` : `The loaded lexical record does not include a usage example for “${lexeme.lemma}”.`;
  } else if (request.operation === "related") {
    const values = claims.flatMap((claim) => claim.values).slice(0, 8);
    text = values.length ? `Moby associates ${lexeme.lemma} with ${values.join(", ")}. These are broad lexical associations, not guaranteed strict synonyms.` : `I do not have an attributed Moby association for “${lexeme.lemma}”.`;
  } else if (request.operation === "provenance") {
    const sources = [...new Map(allClaims.flatMap((claim) => claim.provenance).map((source) => [`${source.sourceId}:${source.sourceLocation}`, source])).values()];
    text = sources.length ? `The loaded record for “${lexeme.lemma}” is attributed to ${sources.map((source) => `${source.sourceId} (${source.sourceLocation})`).join(", ")}.` : `The loaded record for “${lexeme.lemma}” has no attached source.`;
  } else text = `We are discussing ${lexeme.lemma}.`;
  const hasEvidence = request.operation === "recall-topic" || (request.operation === "list-senses" ? senses.length > 0 : claims.length > 0);
  const proof: Dv11ProofStep[] = (claims.length ? claims : allClaims.slice(0, 1)).map((claim, index) => ({
    id: `proof:lexical:${plan.id}:${index}`,
    ruleId: "typed-lexical-retrieval",
    premiseIds: [claim.id],
    conclusion: `${request.operation}:${lexeme.id}`,
    explanation: `Selected the separate lexical ${claim.relation} claim ${claim.id} for ${lexeme.lemma}.`,
  }));
  if (request.operation === "recall-topic" && !proof.length) proof.push({ id: `proof:lexical-topic:${plan.id}`, ruleId: "dialogue-topic-recall", premiseIds: [lexeme.id], conclusion: lexeme.lemma, explanation: `Recalled the active lexeme ${lexeme.id} from transactional dialogue state.` });
  const confidence = { ...plan.confidence, evidence: hasEvidence ? 0.92 : 0.35, proof: proof.length ? 0.9 : 0.25, conflict: 1, realization: 0.96 };
  return {
    clauseId: plan.id,
    status: hasEvidence ? "supported" : "insufficient",
    answerShape: plan.answerShape,
    bindings: [],
    propositions: [],
    lexicalClaims: claims.length ? claims : allClaims.slice(0, 1),
    selectedLexicalSenseIndex: selectedIndex,
    proof,
    missingSlots: hasEvidence ? [] : [`lexical-${relation ?? "evidence"}`],
    reason: hasEvidence ? undefined : `The lexeme exists, but the requested ${relation ?? "evidence"} is unavailable.`,
    confidence,
    calibratedConfidence: 0,
    text,
  };
}

function executeAbilityQuantifier(
  plan: Dv11ClausePlan,
  store: Dv11KnowledgeStore,
  options: Dv11EngineOptions,
): Dv11ClauseResult | undefined {
  const quantifier = plan.quantifiers[0];
  const pattern = plan.patterns[0];
  if (plan.operation !== "verify" || pattern?.relation !== "ability" || pattern.subject.kind !== "entity"
    || !quantifier || !["all", "each", "any", "some", "none", "most"].includes(quantifier.kind)) return undefined;

  const membershipFacts = store.inverse("is_a", { kind: "entity", entityId: pattern.subject.entityId });
  const memberIds = [...new Set(membershipFacts.map((fact) => fact.subjectId))];
  if (!memberIds.length) return emptyResult(plan, "unknown", "The quantified class has no recorded evaluation universe.");

  const matching: string[] = [];
  const nonMatching: string[] = [];
  const missing: string[] = [];
  const propositions: Dv11Proposition[] = [...membershipFacts];
  const proof: Dv11ProofStep[] = [];
  for (const memberId of memberIds) {
    throwIfAborted(options.signal);
    const memberPattern: Dv11Pattern = { ...pattern, subject: { kind: "entity", entityId: memberId } };
    const rows = applyPattern([{ binding: {}, propositions: [], proof: [] }], memberPattern, plan, store, options.now?.() ?? new Date(), options.signal);
    const facts = rows.flatMap((row) => row.propositions).filter((fact) => fact.object.kind === "boolean");
    propositions.push(...facts);
    proof.push(...rows.flatMap((row) => row.proof));
    if (facts.some((fact) => fact.object.kind === "boolean" && fact.object.value)) matching.push(memberId);
    else if (facts.some((fact) => fact.object.kind === "boolean" && !fact.object.value)) nonMatching.push(memberId);
    else missing.push(memberId);
  }

  const universeSize = memberIds.length;
  let verdict: boolean | undefined;
  if (quantifier.kind === "all" || quantifier.kind === "each") verdict = nonMatching.length ? false : missing.length ? undefined : true;
  else if (quantifier.kind === "any" || quantifier.kind === "some") verdict = matching.length ? true : missing.length ? undefined : false;
  else if (quantifier.kind === "none") verdict = matching.length ? false : missing.length ? undefined : true;
  else {
    const threshold = Math.floor(universeSize / 2) + 1;
    verdict = matching.length >= threshold ? true : matching.length + missing.length < threshold ? false : undefined;
  }

  const uniquePropositions = [...new Map(propositions.map((fact) => [fact.id, fact])).values()];
  const coverage = (universeSize - missing.length) / universeSize;
  proof.push({
    id: `proof:quantifier:${plan.id}`,
    ruleId: dv11Rule("quantifier").id,
    premiseIds: uniquePropositions.map((fact) => fact.id),
    conclusion: verdict === undefined ? "unknown" : String(verdict),
    explanation: `Evaluated ${quantifier.kind} across ${universeSize} recorded universe members: ${matching.length} matched, ${nonMatching.length} did not match, ${missing.length} lacked evidence; coverage ${(coverage * 100).toFixed(1)}%.`,
  });
  const confidence = { ...plan.confidence, evidence: coverage, proof: verdict === undefined ? coverage * 0.7 : coverage, conflict: 1, realization: 0.92 };
  return {
    clauseId: plan.id,
    status: verdict === undefined ? "insufficient" : verdict ? "supported" : "contradicted",
    answerShape: "boolean",
    bindings: memberIds.map((entityId) => ({ member: { kind: "entity", entityId } })),
    propositions: uniquePropositions,
    proof,
    verdict,
    returnedCount: matching.length,
    missingSlots: missing.map((entityId) => `evidence:${entityId}`),
    reason: verdict === undefined ? "The recorded universe is incomplete for this quantifier." : undefined,
    confidence,
    calibratedConfidence: verdict === undefined ? Math.min(0.7, coverage) : Math.min(0.96, 0.82 + coverage * 0.14),
  };
}

function executeClause(plan: Dv11ClausePlan, store: Dv11KnowledgeStore, options: Dv11EngineOptions): Dv11ClauseResult {
  throwIfAborted(options.signal);
  if (plan.operation === "lexical") return lexicalResult(plan, store);
  if (plan.unresolvedSlots.length) return emptyResult(plan, plan.unresolvedSlots.includes("entity-sense") ? "ambiguous" : "insufficient", `Missing ${plan.unresolvedSlots.join(", ")}.`);
  if (plan.operation === "calculate") {
    const calculated = calculateExpression(plan.source.text);
    if (calculated.value === undefined) return emptyResult(plan, "unknown", calculated.reason ?? "Calculation failed.");
    const confidence = { ...plan.confidence, evidence: 1, proof: 1, conflict: 1, realization: 0.95 };
    return { clauseId: plan.id, status: "supported", answerShape: "number", bindings: [{ answer: { kind: "number", value: calculated.value } }], propositions: [], proof: calculated.proof, aggregate: { kind: "number", value: calculated.value }, missingSlots: [], confidence, calibratedConfidence: 0.96 };
  }
  if (plan.operation === "infer") {
    const inferred = inferSyllogism(plan.source.text);
    if (!inferred) return emptyResult(plan, "unknown", "The logical form is incomplete or unsupported.");
    const confidence = { ...plan.confidence, evidence: 1, proof: 1, conflict: 1, realization: 0.96 };
    return { clauseId: plan.id, status: inferred.verdict ? "supported" : "contradicted", answerShape: "boolean", bindings: [], propositions: [], proof: inferred.proof, verdict: inferred.verdict, missingSlots: [], confidence, calibratedConfidence: 0.96 };
  }
  if (["remember", "recall", "correct", "retract", "explain-proof"].includes(plan.operation)) return emptyResult(plan, "unknown", "Dialogue operation requires session state.");

  const quantifiedAbility = executeAbilityQuantifier(plan, store, options);
  if (quantifiedAbility) return quantifiedAbility;

  let rows: ExecutionRow[] = [{ binding: {}, propositions: [], proof: [] }];
  for (const pattern of plan.patterns) {
    rows = applyPattern(rows, pattern, plan, store, options.now?.() ?? new Date(), options.signal);
    if (!rows.length) break;
  }
  rows = uniqueRows(rows.filter((row) => plan.filters.every((filter) => filterRow(row, filter, store))));
  if (!rows.length) {
    const schema = plan.patterns[0] ? dv11PredicateSchema(plan.patterns[0].relation) : undefined;
    const canContradict = plan.operation === "verify" && schema?.worldAssumption === "closed";
    return emptyResult(plan, canContradict ? "contradicted" : "unknown", canContradict ? "The closed-world predicate has no compatible fact." : "No subject-compatible proposition satisfied every bound constraint.");
  }

  if (plan.order.length && plan.answerVariable) {
    for (const order of [...plan.order].reverse()) {
      rows.sort((left, right) => {
        const leftValue = left.binding[order.variable];
        const rightValue = right.binding[order.variable];
        if (!leftValue || !rightValue) return 0;
        const compared = compareValues(leftValue, rightValue, store);
        return order.direction === "ascending" ? compared : -compared;
      });
    }
  }

  const totalRows = rows.length;
  if (plan.offset) rows = rows.slice(plan.offset);
  if (plan.limit !== undefined) rows = rows.slice(0, plan.limit);
  const facts = [...new Map(rows.flatMap((row) => row.propositions).map((fact) => [fact.id, fact])).values()];
  const conflicts = facts.flatMap((fact) => store.conflictsFor(fact));
  const confidence = {
    ...plan.confidence,
    evidence: Math.min(1, facts.length / Math.max(1, plan.patterns.length)),
    proof: Math.min(1, rows.flatMap((row) => row.proof).length / Math.max(1, plan.patterns.length)),
    conflict: conflicts.length ? 0.35 : 1,
    realization: 0.92,
  };

  if (conflicts.length) {
    return { clauseId: plan.id, status: "ambiguous", answerShape: plan.answerShape, bindings: rows.map((row) => row.binding), propositions: [...facts, ...conflicts], proof: rows.flatMap((row) => row.proof), missingSlots: [], reason: "Conflicting functional facts require source or time clarification.", confidence, calibratedConfidence: 0.28 };
  }

  if (plan.operation === "aggregate") {
    const directCount = rows
      .flatMap((row) => row.propositions)
      .find((proposition) => proposition.relation === "count" && (proposition.object.kind === "number" || proposition.object.kind === "quantity"));
    if (directCount) {
      const countObject = directCount.object;
      if (countObject.kind !== "number" && countObject.kind !== "quantity") throw new Error("DV11_COUNT_TYPE_GUARD");
      const countValue = countObject.kind === "number" ? countObject.value : countObject.quantity.value;
      return {
        clauseId: plan.id,
        status: "supported",
        answerShape: "number",
        bindings: [{ answer: { kind: "number", value: countValue } }],
        propositions: [directCount],
        proof: [...rows.flatMap((row) => row.proof), { id: `proof:count:${directCount.id}`, ruleId: "functional-count", premiseIds: [directCount.id], conclusion: String(countValue), explanation: "Read the explicit functional count after applying every subject and temporal constraint." }],
        aggregate: { kind: "number", value: countValue },
        returnedCount: 1,
        missingSlots: [],
        confidence,
        calibratedConfidence: 0.9,
      };
    }
    const count = totalRows;
    const quantifier = plan.quantifiers[0];
    let verdict: boolean | undefined;
    if (quantifier?.cardinality !== undefined) {
      if (quantifier.kind === "exact") verdict = count === quantifier.cardinality;
      if (quantifier.kind === "minimum") verdict = count >= quantifier.cardinality;
      if (quantifier.kind === "maximum") verdict = count <= quantifier.cardinality;
    }
    return { clauseId: plan.id, status: "supported", answerShape: "number", bindings: rows.map((row) => row.binding), propositions: facts, proof: [...rows.flatMap((row) => row.proof), { id: `proof:aggregate:${plan.id}`, ruleId: "distinct-count", premiseIds: facts.map((fact) => fact.id), conclusion: String(count), explanation: `Counted ${count} distinct bindings after all joins and filters.` }], aggregate: { kind: "number", value: count }, verdict, returnedCount: count, missingSlots: [], confidence, calibratedConfidence: 0.9 };
  }

  if (plan.operation === "verify") {
    const positive = rows.some((row) => row.propositions.every((fact) => fact.polarity === "positive"));
    const booleanValues = rows.flatMap((row) => row.propositions)
      .filter((fact) => fact.object.kind === "boolean")
      .map((fact) => fact.object.kind === "boolean" ? fact.object.value : undefined)
      .filter((value): value is boolean => value !== undefined);
    const verdict = booleanValues.length
      ? booleanValues.some((value) => plan.negated ? value === false : value === true)
      : plan.negated ? !positive : positive;
    return { clauseId: plan.id, status: verdict ? "supported" : "contradicted", answerShape: "boolean", bindings: rows.map((row) => row.binding), propositions: facts, proof: rows.flatMap((row) => row.proof), verdict, missingSlots: [], confidence, calibratedConfidence: 0.9 };
  }

  const returnedCount = plan.answerVariable ? new Set(rows.map((row) => JSON.stringify(row.binding[plan.answerVariable!]))).size : facts.length;
  const requestedCount = plan.limit;
  const insufficient = requestedCount !== undefined && returnedCount < requestedCount;
  return {
    clauseId: plan.id,
    status: insufficient ? "insufficient" : "supported",
    answerShape: plan.answerShape,
    bindings: rows.map((row) => row.binding),
    propositions: facts,
    proof: rows.flatMap((row) => row.proof),
    requestedCount,
    returnedCount,
    missingSlots: [],
    reason: insufficient ? `Only ${returnedCount} distinct result${returnedCount === 1 ? "" : "s"} are proven.` : undefined,
    confidence,
    calibratedConfidence: insufficient ? 0.72 : 0.91,
  };
}

export function executeDv11Plan(
  plan: Dv11QueryPlan,
  store: Dv11KnowledgeStore = dv11KnowledgeStore,
  options: Dv11EngineOptions = {},
): Dv11ExecutionResult {
  try {
    throwIfAborted(options.signal);
    const clauses = plan.clauses.map((clause) => executeClause(clause, store, options));
    const statuses = new Set(clauses.map((clause) => clause.status));
    const status = statuses.size === 1
      ? clauses[0]?.status ?? "unknown"
      : statuses.has("error")
        ? "error"
        : statuses.has("canceled")
          ? "canceled"
          : "partial";
    const failed = clauses.find((clause) => !["supported", "contradicted"].includes(clause.status));
    return {
      status,
      plan,
      clauses,
      proof: clauses.flatMap((clause) => clause.proof),
      calibratedConfidence: clauses.length ? Math.min(...clauses.map((clause) => clause.calibratedConfidence)) : 0,
      failureStage: failed ? failed.status === "ambiguous" || failed.status === "insufficient" ? "parsing" : "retrieval" : undefined,
      failureCode: failed ? `DV11_${failed.status.toLocaleUpperCase("en-US")}` : undefined,
    };
  } catch (error) {
    const canceled = error instanceof DOMException && error.name === "AbortError";
    return {
      status: canceled ? "canceled" : "error",
      plan,
      clauses: plan.clauses.map((clause) => emptyResult(clause, canceled ? "canceled" : "error", error instanceof Error ? error.message : String(error))),
      proof: [],
      calibratedConfidence: 0,
      failureStage: canceled ? "state-mutation" : "reasoning",
      failureCode: canceled ? "DV11_CANCELED" : "DV11_EXECUTOR_ERROR",
    };
  }
}
