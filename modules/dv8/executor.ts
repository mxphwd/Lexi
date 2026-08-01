import { predicateById } from "@/modules/knowledge-graph";
import type { SemanticRelation } from "@/modules/semantic";
import { contentTokens, dv8Normalize, phraseCompatible } from "./normalize";
import type { Dv8FactStore } from "./facts";
import type {
  ExecutionProof,
  ExecutionResult,
  LiteralValue,
  NormalizedFact,
  QueryBinding,
  QueryFilter,
  QueryPlan,
  QueryTerm,
  TriplePattern,
} from "./types";

function termValue(term: QueryTerm, binding: QueryBinding): LiteralValue | undefined {
  if (term.kind === "variable") return binding[term.name];
  return term;
}

function bindTerm(
  term: QueryTerm,
  value: LiteralValue,
  binding: QueryBinding,
  store: Dv8FactStore,
): QueryBinding | undefined {
  if (term.kind !== "variable") return store.compatible(term, value) ? binding : undefined;
  const current = binding[term.name];
  if (current && !store.compatible(current, value)) return undefined;
  return current ? binding : { ...binding, [term.name]: value };
}

function factObjectMatches(
  fact: NormalizedFact,
  term: QueryTerm,
  binding: QueryBinding,
  store: Dv8FactStore,
): boolean {
  const requested = termValue(term, binding);
  if (!requested) return true;
  if (store.compatible(fact.object, requested)) return true;
  if (
    fact.object.kind === "boolean" &&
    requested.kind === "text" &&
    fact.qualifiers?.scope
  ) {
    const requestedAction = requested.value.replace(/^(?:not|never)\s+/, "");
    return phraseCompatible(fact.qualifiers.scope, requestedAction);
  }
  return false;
}

function inheritedFacts(
  store: Dv8FactStore,
  subjectId: string,
  predicate: SemanticRelation,
): { facts: NormalizedFact[]; proof: ExecutionProof[] } {
  const direct = store.direct(subjectId, predicate);
  if (direct.length) {
    return {
      facts: direct,
      proof: [{
        rule: "direct-index",
        factIds: direct.map((fact) => fact.id),
        explanation: `Read ${predicate} from the compiled subject-predicate index.`,
      }],
    };
  }

  const equivalents: Partial<Record<SemanticRelation, SemanticRelation[]>> = {
    function: ["purpose"], purpose: ["function"],
    has_part: ["component"], component: ["has_part"],
    location: ["habitat"], habitat: ["location"],
  };
  for (const equivalent of equivalents[predicate] ?? []) {
    const facts = store.direct(subjectId, equivalent);
    if (facts.length) {
      return {
        facts,
        proof: [{
          rule: "direct-index",
          factIds: facts.map((fact) => fact.id),
          explanation: `Mapped compatible ${equivalent} facts to ${predicate}.`,
        }],
      };
    }
  }

  if (!predicateById.get(predicate)?.inheritable) return { facts: [], proof: [] };
  for (const ancestor of store.ancestors(subjectId)) {
    const facts = store.direct(ancestor.entityId, predicate);
    if (!facts.length) continue;
    return {
      facts,
      proof: [{
        rule: "inheritance",
        factIds: [...ancestor.facts, ...facts].map((fact) => fact.id),
        explanation: `Inherited ${predicate} through an explicit classification path.`,
      }],
    };
  }
  return { facts: [], proof: [] };
}

function candidatesFor(
  pattern: TriplePattern,
  binding: QueryBinding,
  store: Dv8FactStore,
): { facts: NormalizedFact[]; proof: ExecutionProof[] } {
  const subject = termValue(pattern.subject, binding);
  const object = termValue(pattern.object, binding);
  if (subject?.kind === "entity") return inheritedFacts(store, subject.entityId, pattern.predicate);
  if (object) {
    return {
      facts: store.inverse(pattern.predicate, object),
      proof: [{
        rule: "inverse-index",
        factIds: [],
        explanation: `Used the compiled ${pattern.predicate}-object inverse index.`,
      }],
    };
  }
  return {
    facts: store.relation(pattern.predicate),
    proof: [{
      rule: "direct-index",
      factIds: [],
      explanation: `Scanned only the indexed ${pattern.predicate} relation bucket.`,
    }],
  };
}

function applyPattern(
  pattern: TriplePattern,
  bindings: Array<{ binding: QueryBinding; facts: NormalizedFact[]; proof: ExecutionProof[] }>,
  store: Dv8FactStore,
) {
  const next: typeof bindings = [];
  for (const row of bindings) {
    const candidates = candidatesFor(pattern, row.binding, store);
    for (const fact of candidates.facts) {
      if (!factObjectMatches(fact, pattern.object, row.binding, store)) continue;
      let binding = bindTerm(
        pattern.subject,
        { kind: "entity", entityId: fact.subjectId },
        row.binding,
        store,
      );
      if (!binding) continue;
      if (pattern.object.kind === "variable") {
        const objectBindingValue =
          fact.object.kind === "boolean" && fact.qualifiers?.scope
            ? ({ kind: "text", value: fact.qualifiers.scope } as const)
            : fact.object;
        binding = bindTerm(pattern.object, objectBindingValue, binding, store);
        if (!binding) continue;
      }
      next.push({
        binding,
        facts: [...row.facts, fact],
        proof: [
          ...row.proof,
          ...candidates.proof.map((proof) => ({
            ...proof,
            factIds: proof.factIds.length ? proof.factIds : [fact.id],
          })),
        ],
      });
    }
  }
  return next;
}

function compareLiteral(
  left: LiteralValue,
  operator: Extract<QueryFilter, { kind: "compare" }>["operator"],
  right: LiteralValue,
  store: Dv8FactStore,
) {
  if (operator === "eq") return store.compatible(left, right);
  if (operator === "ne") return !store.compatible(left, right);
  if (left.kind !== "number" || right.kind !== "number") return false;
  const converted = store.convert(right.value, right.unit, left.unit);
  if (converted === undefined) return false;
  if (operator === "gt") return left.value > converted;
  if (operator === "gte") return left.value >= converted;
  if (operator === "lt") return left.value < converted;
  return left.value <= converted;
}

function applyFilters(
  rows: Array<{ binding: QueryBinding; facts: NormalizedFact[]; proof: ExecutionProof[] }>,
  filters: QueryFilter[],
  store: Dv8FactStore,
) {
  return rows.filter((row) => filters.every((filter) => {
    if (filter.kind === "time") {
      return row.facts.every((fact) => {
        if (!fact.qualifiers?.time) {
          // Intrinsic facts are timeless; event predicates require a dated record.
          return !["capital", "currency", "language", "year", "birth_year", "founded_year"].includes(fact.predicate);
        }
        return phraseCompatible(fact.qualifiers.time, filter.value);
      });
    }
    if (filter.kind === "condition") return true;
    const value = row.binding[filter.variable];
    if (!value) return false;
    if (filter.kind === "class") {
      if (value.kind !== "entity") return false;
      if (filter.classId.startsWith("kind:")) {
        return store.graph.entity(value.entityId)?.kind === filter.classId.slice(5);
      }
      return store.isA(value.entityId, filter.classId).value;
    }
    if (filter.kind === "contains") return store.literalText(value).includes(filter.value);
    return filter.value.kind !== "variable" &&
      compareLiteral(value, filter.operator, filter.value, store);
  }));
}

function conditionVerdict(
  plan: QueryPlan,
  facts: NormalizedFact[],
): "satisfied" | "contradicted" | "unspecified" {
  const required = facts.map((fact) => fact.qualifiers?.condition).find(Boolean);
  if (!required) return "satisfied";
  if (!plan.condition) return "unspecified";
  const query = dv8Normalize(plan.condition);
  const needed = dv8Normalize(required);
  if (phraseCompatible(query.replace(/\bnot\b/g, ""), needed)) {
    return /\b(?:not|never|no)\b/.test(query) ? "contradicted" : "satisfied";
  }
  const overlap = contentTokens(query).filter((token) => contentTokens(needed).includes(token));
  return overlap.length >= 2 ? "satisfied" : "contradicted";
}

const disjointTaxonomicClasses = new Set([
  "class-mammal", "class-bird", "class-fish", "class-reptile", "class-amphibian",
  "class-insect", "class-arachnid",
]);

function classificationResult(plan: QueryPlan, store: Dv8FactStore): ExecutionResult | undefined {
  const pattern = plan.patterns[0];
  if (!pattern || pattern.predicate !== "is_a") return undefined;
  if (pattern.subject.kind !== "entity" || pattern.object.kind !== "entity") return undefined;
  const positive = store.isA(pattern.subject.entityId, pattern.object.entityId);
  if (positive.value) {
    const verdict = plan.negated ? false : true;
    return {
      status: "answered", operation: plan.operation, bindings: [], facts: positive.facts,
      proof: [{
        rule: positive.facts.length > 1 ? "transitive" : "direct-index",
        factIds: positive.facts.map((fact) => fact.id),
        explanation: positive.facts.length > 1
          ? "Joined explicit classification edges transitively."
          : "Used the direct classification edge.",
      }],
      verdict, confidence: 1,
    };
  }
  const ancestors = store.ancestors(pattern.subject.entityId).map((item) => item.entityId);
  const disjoint = disjointTaxonomicClasses.has(pattern.object.entityId) &&
    ancestors.some((ancestor) => disjointTaxonomicClasses.has(ancestor));
  if (!disjoint) return undefined;
  return {
    status: "answered", operation: plan.operation, bindings: [], facts: [],
    proof: [{ rule: "explicit-negative", factIds: [], explanation: "The requested class conflicts with the subject's explicit taxonomic class." }],
    verdict: plan.negated ? true : false, confidence: 0.99,
  };
}

function quantifiedResult(plan: QueryPlan, store: Dv8FactStore): ExecutionResult | undefined {
  if (!plan.quantifier) return undefined;
  const classFilter = plan.filters.find(
    (filter): filter is Extract<QueryFilter, { kind: "class" }> => filter.kind === "class",
  );
  const pattern = plan.patterns[0];
  if (!classFilter || !pattern) return undefined;
  const members = store.graph.allEntities().filter(
    (candidate) => candidate.id !== classFilter.classId && store.isA(candidate.id, classFilter.classId).value,
  );
  if (!members.length) return undefined;
  const outcomes = members.map((member) => {
    const directPlan: QueryPlan = {
      ...plan,
      quantifier: undefined,
      filters: plan.filters.filter((filter) => filter !== classFilter),
      patterns: [{ ...pattern, subject: { kind: "entity", entityId: member.id } }],
    };
    return executeQueryPlan(directPlan, store);
  });
  const trueCount = outcomes.filter((outcome) => outcome.verdict === true).length;
  const falseCount = outcomes.filter((outcome) => outcome.verdict === false).length;
  let verdict: boolean | undefined;
  if (plan.quantifier === "all") verdict = falseCount > 0 ? false : trueCount === members.length ? true : undefined;
  if (plan.quantifier === "any") verdict = trueCount > 0 ? true : falseCount === members.length ? false : undefined;
  if (plan.quantifier === "none") verdict = trueCount > 0 ? false : falseCount === members.length ? true : undefined;
  if (verdict === undefined) return undefined;
  return {
    status: "answered", operation: "ask", bindings: [],
    facts: outcomes.flatMap((outcome) => outcome.facts),
    proof: [{ rule: "aggregate", factIds: outcomes.flatMap((outcome) => outcome.facts.map((fact) => fact.id)), explanation: `Evaluated ${plan.quantifier} across ${members.length} explicit class members.` }],
    verdict, aggregateValue: members.length, confidence: 0.96,
  };
}

function executeComparison(plan: QueryPlan, store: Dv8FactStore): ExecutionResult {
  let rows = [{ binding: {}, facts: [], proof: [] }] as Array<{ binding: QueryBinding; facts: NormalizedFact[]; proof: ExecutionProof[] }>;
  for (const pattern of plan.patterns) rows = applyPattern(pattern, rows, store);
  const row = rows.find((candidate) => candidate.binding.left?.kind === "number" && candidate.binding.right?.kind === "number") ?? rows[0];
  const left = row?.binding.left;
  const right = row?.binding.right;
  if (!row || !left || !right) return unknown(plan, "The two subjects do not have compatible recorded values for this comparison.");
  let equal = store.compatible(left, right);
  let winner: "left" | "right" | undefined;
  if (left.kind === "number" && right.kind === "number") {
    const converted = store.convert(right.value, right.unit, left.unit);
    if (converted === undefined) return unknown(plan, "The recorded units cannot be compared safely.");
    equal = left.value === converted;
    if (!equal) winner = left.value > converted ? "left" : "right";
  }
  return {
    status: "answered", operation: "compare", bindings: [row.binding], facts: row.facts,
    proof: [...row.proof, { rule: "comparison", factIds: row.facts.map((fact) => fact.id), explanation: "Compared normalized typed literals with compatible units." }],
    comparison: { left, right, winner, equal }, confidence: 0.98,
  };
}

function unknown(plan: QueryPlan, reason: string): ExecutionResult {
  return {
    status: "unknown", operation: plan.operation, bindings: [], facts: [],
    proof: [{ rule: "calibrated-unknown", factIds: [], explanation: reason }],
    confidence: 1, reason,
  };
}

export function executeQueryPlan(plan: QueryPlan, store: Dv8FactStore): ExecutionResult {
  if (plan.operation === "clarify") return { ...unknown(plan, "The typed plan is unresolved."), status: "ambiguous" };
  if (plan.operation === "transform") return unknown(plan, "Transform plans execute in the deterministic task module.");
  if (plan.operation === "compare") return executeComparison(plan, store);

  const quantified = quantifiedResult(plan, store);
  if (quantified) return quantified;
  const classification = classificationResult(plan, store);
  if (classification) return classification;

  let rows = [{ binding: {}, facts: [], proof: [] }] as Array<{ binding: QueryBinding; facts: NormalizedFact[]; proof: ExecutionProof[] }>;
  for (const pattern of plan.patterns) {
    rows = applyPattern(pattern, rows, store);
    if (!rows.length) break;
  }
  rows = applyFilters(rows, plan.filters, store);
  if (!rows.length) {
    const pattern = plan.patterns[0];
    const functionalRelations = new Set<SemanticRelation>([
      "leg_count", "atomic_number", "symbol", "birth_year", "founded_year", "year",
    ]);
    if (
      plan.operation === "ask" &&
      pattern?.subject.kind === "entity" &&
      pattern.object.kind !== "variable" &&
      functionalRelations.has(pattern.predicate) &&
      inheritedFacts(store, pattern.subject.entityId, pattern.predicate).facts.length
    ) {
      return {
        status: "answered", operation: "ask", bindings: [], facts: [],
        proof: [{ rule: "explicit-negative", factIds: [], explanation: "A different explicit value is recorded for this functional property." }],
        verdict: plan.negated ? true : false, confidence: 0.99,
      };
    }
    return unknown(plan, "No subject-compatible fact path satisfied every pattern and filter.");
  }

  const uniqueRows = [...new Map(rows.map((row) => [JSON.stringify(row.binding), row])).values()];
  if (plan.operation === "aggregate") {
    const variable = plan.aggregate?.variable;
    const values = new Set(uniqueRows.map((row) => variable ? JSON.stringify(row.binding[variable]) : "").filter(Boolean));
    return {
      status: "answered", operation: "aggregate", bindings: uniqueRows.map((row) => row.binding),
      facts: uniqueRows.flatMap((row) => row.facts),
      proof: [{ rule: "aggregate", factIds: uniqueRows.flatMap((row) => row.facts.map((fact) => fact.id)), explanation: "Counted distinct bindings after every join and filter." }],
      aggregateValue: values.size, confidence: 0.98,
    };
  }

  if (plan.operation === "ask") {
    const facts = uniqueRows.flatMap((row) => row.facts);
    const condition = conditionVerdict(plan, facts);
    const explicitBoolean = facts.find((fact) => fact.object.kind === "boolean");
    let actual = explicitBoolean?.object.kind === "boolean" ? explicitBoolean.object.value : true;
    if (condition === "contradicted") actual = false;
    const verdict = condition === "unspecified" ? undefined : plan.negated ? !actual : actual;
    return {
      status: "answered", operation: "ask", bindings: uniqueRows.map((row) => row.binding), facts,
      proof: uniqueRows.flatMap((row) => row.proof), verdict,
      confidence: condition === "unspecified" ? 0.9 : 0.98,
      reason: condition === "unspecified" ? "The supporting fact has a condition that the question did not establish." : undefined,
    };
  }

  return {
    status: "answered", operation: plan.operation,
    bindings: uniqueRows.map((row) => row.binding),
    facts: uniqueRows.flatMap((row) => row.facts),
    proof: uniqueRows.flatMap((row) => row.proof), confidence: 0.98,
  };
}
