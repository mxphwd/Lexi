import { normalizeText } from "@/modules/search/tokenize";
import type { SemanticQuery, SemanticRelation } from "@/modules/semantic";
import { predicateById } from "./predicates";
import type { KnowledgeGraph } from "./graph";
import type {
  GraphAnswer,
  KnowledgeProposition,
  ProofStep,
  PropositionValue,
} from "./types";

type ProvenProposition = {
  proposition: KnowledgeProposition;
  proof: ProofStep;
};

function entityObjectId(proposition: KnowledgeProposition): string | undefined {
  return proposition.object.kind === "entity"
    ? proposition.object.entityId
    : undefined;
}

function directProof(proposition: KnowledgeProposition): ProofStep {
  return {
    rule: "direct",
    propositionIds: [proposition.id],
    explanation: `Used the recorded ${proposition.predicate} proposition.`,
  };
}

function ancestors(
  graph: KnowledgeGraph,
  subjectId: string,
): Array<{ id: string; path: KnowledgeProposition[] }> {
  const found: Array<{ id: string; path: KnowledgeProposition[] }> = [];
  const queue: Array<{ id: string; path: KnowledgeProposition[] }> = [
    { id: subjectId, path: [] },
  ];
  const visited = new Set([subjectId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const proposition of graph.direct(current.id, "is_a")) {
      const parentId = entityObjectId(proposition);
      if (!parentId || visited.has(parentId)) continue;
      visited.add(parentId);
      const path = [...current.path, proposition];
      found.push({ id: parentId, path });
      queue.push({ id: parentId, path });
    }
  }
  return found;
}

function factsFor(
  graph: KnowledgeGraph,
  subjectId: string,
  relation: SemanticRelation,
): ProvenProposition[] {
  const direct = graph.direct(subjectId, relation);
  if (direct.length > 0) {
    return direct.map((proposition) => ({
      proposition,
      proof: directProof(proposition),
    }));
  }

  const equivalentRelations: Partial<Record<SemanticRelation, SemanticRelation[]>> = {
    function: ["purpose"],
    purpose: ["function"],
    has_part: ["component"],
    component: ["has_part"],
    location: ["habitat"],
    habitat: ["location"],
  };
  for (const equivalent of equivalentRelations[relation] ?? []) {
    const equivalentFacts = graph.direct(subjectId, equivalent);
    if (equivalentFacts.length === 0) continue;
    return equivalentFacts.map((proposition) => ({
      proposition,
      proof: {
        rule: "direct",
        propositionIds: [proposition.id],
        explanation: `Used the recorded ${equivalent} proposition as the compatible ${relation} relation.`,
      },
    }));
  }

  const predicate = predicateById.get(relation);
  if (!predicate?.inheritable) return [];
  for (const ancestor of ancestors(graph, subjectId)) {
    const inherited = graph.direct(ancestor.id, relation);
    if (inherited.length === 0) continue;
    return inherited.map((proposition) => ({
      proposition,
      proof: {
        rule: "inheritance",
        propositionIds: [
          ...ancestor.path.map((step) => step.id),
          proposition.id,
        ],
        explanation: `Inherited ${relation} through the recorded classification path.`,
      },
    }));
  }
  return [];
}

function normalizedValue(
  value: PropositionValue,
  graph: KnowledgeGraph,
): string[] {
  switch (value.kind) {
    case "entity": {
      const entity = graph.entity(value.entityId);
      return entity ? [normalizeText(entity.name)] : [normalizeText(value.entityId)];
    }
    case "text":
      return [normalizeText(value.value)];
    case "number":
      return [normalizeText(`${value.value}${value.unit ? ` ${value.unit}` : ""}`)];
    case "boolean":
      return [String(value.value)];
    case "list":
      return value.values.map(normalizeText);
  }
}

function semanticallyContains(recorded: string, requested: string): boolean {
  const left = normalizeText(recorded);
  const right = normalizeText(requested)
    .replace(/^(?:a|an|the)\s+/, "")
    .replace(/\b(?:at all|or not)\b$/, "")
    .trim();
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;

  const leftTokens = new Set(left.split(" "));
  const rightTokens = right.split(" ").filter((token) => token.length > 2);
  return rightTokens.length > 0 && rightTokens.every((token) => leftTokens.has(token));
}

function matchingFacts(
  facts: ProvenProposition[],
  requested: string | undefined,
  graph: KnowledgeGraph,
): ProvenProposition[] {
  if (!requested) return facts;
  return facts.filter(({ proposition }) => {
    const scope = proposition.qualifiers?.scope;
    if (scope && semanticallyContains(scope, requested)) return true;
    return normalizedValue(proposition.object, graph).some((value) =>
      semanticallyContains(value, requested),
    );
  });
}

function classificationAnswer(
  graph: KnowledgeGraph,
  query: SemanticQuery,
): GraphAnswer | undefined {
  if (!query.subjectId || !query.objectId) return undefined;
  if (query.subjectId === query.objectId) {
    return {
      propositions: [],
      proof: [{
        rule: "classification",
        propositionIds: [],
        explanation: "The subject and requested class resolve to the same entity.",
      }],
      confidence: 1,
      verdict: true,
      relation: "is_a",
    };
  }

  const ancestor = ancestors(graph, query.subjectId).find(
    (candidate) => candidate.id === query.objectId,
  );
  if (!ancestor) return undefined;
  return {
    propositions: ancestor.path,
    proof: [{
      rule: ancestor.path.length > 1 ? "transitive" : "classification",
      propositionIds: ancestor.path.map((step) => step.id),
      explanation:
        ancestor.path.length > 1
          ? "Joined the explicit classification links transitively."
          : "Used the direct classification link.",
    }],
    confidence: 1,
    verdict: true,
    relation: "is_a",
  };
}

function compare(
  graph: KnowledgeGraph,
  query: SemanticQuery,
): GraphAnswer | undefined {
  if (!query.subjectId || !query.objectId) return undefined;
  const requestedRelation = query.relation === "comparison"
    ? undefined
    : query.relation;
  const priority: SemanticRelation[] = requestedRelation
    ? [requestedRelation]
    : [
        "definition",
        "is_a",
        "purpose",
        "mechanism",
        "location",
        "composition",
        "diet",
        "leg_count",
        "size",
        "importance",
      ];

  for (const relation of priority) {
    const left = factsFor(graph, query.subjectId, relation);
    const right = factsFor(graph, query.objectId, relation);
    if (left.length === 0 || right.length === 0) continue;
    const selected = [...left.slice(0, 2), ...right.slice(0, 2)];
    return {
      propositions: selected.map((item) => item.proposition),
      proof: [
        ...selected.map((item) => item.proof),
        {
          rule: "comparison",
          propositionIds: selected.map((item) => item.proposition.id),
          explanation: `Compared the two subjects using their recorded ${relation} propositions.`,
        },
      ],
      confidence: selected.every((item) => item.proof.rule === "direct") ? 1 : 0.94,
      comparedSubjectIds: [query.subjectId, query.objectId],
      relation,
    };
  }
  return undefined;
}

export function answerKnowledgeQuery(
  graph: KnowledgeGraph,
  query: SemanticQuery,
): GraphAnswer | undefined {
  if (!query.subjectId) return undefined;
  if (query.kind === "comparison") return compare(graph, query);
  if (query.kind === "boolean" && query.relation === "is_a") {
    return classificationAnswer(graph, query);
  }

  let facts = factsFor(graph, query.subjectId, query.relation);
  let answeredRelation = query.relation;
  if (
    facts.length === 0 &&
    query.kind === "boolean" &&
    query.relation !== "ability" &&
    query.ability
  ) {
    facts = factsFor(graph, query.subjectId, "ability");
    answeredRelation = "ability";
  }
  if (facts.length === 0) return undefined;

  if (query.kind === "boolean") {
    const requested = query.ability ?? query.objectText;
    const matched = matchingFacts(facts, requested, graph);
    if (matched.length === 0) return undefined;
    const explicitBoolean = matched.find(
      ({ proposition }) => proposition.object.kind === "boolean",
    );
    const verdict = explicitBoolean?.proposition.object.kind === "boolean"
      ? explicitBoolean.proposition.object.value
      : true;
    return {
      propositions: matched.map((item) => item.proposition),
      proof: matched.map((item) => item.proof),
      confidence: matched.every((item) => item.proof.rule === "direct") ? 1 : 0.94,
      verdict,
      relation: answeredRelation,
    };
  }

  return {
    propositions: facts.map((item) => item.proposition),
    proof: facts.map((item) => item.proof),
    confidence: facts.every((item) => item.proof.rule === "direct") ? 1 : 0.94,
    relation: answeredRelation,
  };
}

export function graphFactsFor(
  graph: KnowledgeGraph,
  subjectId: string,
  relation: SemanticRelation,
) {
  return factsFor(graph, subjectId, relation);
}
