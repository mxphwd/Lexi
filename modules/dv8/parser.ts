import { analyseSentence } from "@/modules/search";
import type { SemanticRelation } from "@/modules/semantic";
import { relationFromLabel } from "@/modules/semantic";
import type { CompiledLexicalIndex, ResolvedMention } from "./lexicon";
import { contentTokens, dv8Normalize } from "./normalize";
import type { QueryPlan, QueryTerm } from "./types";

export type Dv8ParseContext = {
  activeSubjectIds?: readonly string[];
};

const relationPhrases: ReadonlyArray<readonly [SemanticRelation, readonly string[]]> = [
  ["atomic_number", ["atomic number", "periodic table number"]],
  ["leg_count", ["how many legs", "number of legs", "leg count", "many limbs"]],
  ["invented_by", ["invented", "invent", "inventor", "came up with", "devised"]],
  ["discovered_by", ["discovered", "discoverer", "found by"]],
  ["written_by", ["wrote", "write", "written by", "author", "authored"]],
  ["created_by", ["created", "creator", "made by", "designed by"]],
  ["founded_by", ["founded by", "founder", "started by"]],
  ["founded_year", ["founded when", "founding year", "when was founded"]],
  ["birth_year", ["born", "birth year", "year of birth"]],
  ["known_for", ["known for", "famous for", "contribution"]],
  ["nationality", ["nationality", "country was from", "where was born"]],
  ["capital", ["capital", "capital city"]],
  ["continent", ["continent"]],
  ["country", ["country", "nation"]],
  ["currency", ["currency", "money does", "kind of money"]],
  ["language", ["language", "spoken in", "official tongue"]],
  ["habitat", ["habitat", "live in", "lives in", "find in the wild", "natural home"]],
  ["diet", ["diet", "eat", "eats", "food"]],
  ["lifespan", ["lifespan", "life span", "life expectancy", "how long live"]],
  ["temperature", ["temperature", "how hot", "how cold", "degrees"]],
  ["composition", ["made of", "made from", "composition", "material"]],
  ["color", ["color", "colour"]],
  ["size", ["size", "diameter", "mass", "weight", "larger", "smaller", "bigger", "heavier", "taller", "longer"]],
  ["symbol", ["symbol", "represented as", "chemical sign"]],
  ["contains", ["contain", "contains", "inside", "contents"]],
  ["produces", ["produce", "produces", "make", "makes", "yield"]],
  ["requires", ["require", "requires", "need", "needs", "depend on"]],
  ["has_part", ["parts", "components", "elements", "consists of", "have"]],
  ["part_of", ["part of", "belongs to", "inside which"]],
  ["location", ["where is", "where are", "located", "location", "position"]],
  ["year", ["what year", "which year", "date of", "when did"]],
  ["cause", ["cause", "causes", "reason for", "why does", "why is"]],
  ["effect", ["effect", "result", "impact", "leads to", "happens because"]],
  ["function", ["function", "role", "job", "what does"]],
  ["purpose", ["used for", "purpose", "why use", "use of"]],
  ["mechanism", ["how does", "how do", "works", "mechanism", "process behind"]],
  ["importance", ["important", "matter", "significance", "why care"]],
  ["example", ["example", "illustrate", "instance"]],
  ["related_to", ["related", "connected", "associated", "have in common"]],
  ["is_a", ["type of", "kind of", "classified as", "category"]],
  ["formula", ["formula", "equation"]],
  ["unit", ["unit", "measured in"]],
  ["ability", ["ability", "can", "capable", "able to"]],
  ["definition", ["what is", "what are", "who is", "define", "definition", "describe", "tell me about", "explain"]],
];

const inverseActorRelations = new Set<SemanticRelation>([
  "invented_by", "discovered_by", "written_by", "created_by", "founded_by",
]);

function hasPhrase(input: string, phrase: string): boolean {
  return ` ${input} `.includes(` ${phrase} `) || input.startsWith(`${phrase} `) || input.endsWith(` ${phrase}`);
}

function detectRelation(input: string): SemanticRelation | undefined {
  const statedProperty = input.match(
    /^(?:state|give|identify)(?: me)? (?:the )?(.+?) of\b/,
  )?.[1];
  if (statedProperty) {
    const mapped = relationFromLabel(statedProperty);
    if (mapped) return mapped;
  }
  if (/\b(?:used for|purpose of|what.+for)\b/.test(input)) return "purpose";
  if (/\b(?:related to|connected to|associated with|have in common)\b/.test(input)) return "related_to";
  if (/^how .*(?:do|does|did).+work\b/.test(input)) return "mechanism";
  if (/^(?:can|could|would|will) you (?:define|describe|introduce|tell me about)\b/.test(input)) return "definition";
  if (/^(?:can|could|would|will) you explain\b(?!.*\bhow\b)/.test(input)) return "definition";
  if (/\b(?:important|importance|matter|significance|care about|why care)\b/.test(input)) return "importance";
  if (/\b(?:where.+(?:find|see).+(?:wild|nature)|where.+(?:live|found))\b/.test(input)) return "habitat";
  if (/^(?:is|are)\s+.+\s+(?:a|an|the)\s+.+/.test(input)) return "is_a";
  if (/^(?:does|do)\s+.+\s+have\s+\d+(?:\.\d+)?\s+(?:legs|limbs)/.test(input)) return "leg_count";
  if (/^(?:do|does)\s+(?:all|any|some|no)\s+.+\s+(?:fly|swim|breathe|jump|run|produce|use)\b/.test(input)) return "ability";
  for (const [relation, phrases] of relationPhrases) {
    if (phrases.some((phrase) => hasPhrase(input, phrase))) return relation;
  }
  const possessive = input.match(/(?:what|which) (?:is|are) (?:the )?([a-z ]+?) of\b/)?.[1];
  return possessive ? relationFromLabel(possessive) : undefined;
}

function styleOf(input: string): QueryPlan["style"] {
  if (/\b(?:brief|short|concise)\b/.test(input)) return "brief";
  if (/\b(?:simple|simply|plain terms)\b/.test(input)) return "simple";
  if (/\b(?:detail|detailed|thorough)\b/.test(input)) return "detailed";
  if (/\b(?:technical|technically|precise)\b/.test(input)) return "technical";
  if (/\b(?:step by step|stepwise)\b/.test(input)) return "stepwise";
  if (/\b(?:practical|real-world|real world)\b/.test(input)) return "practical";
  if (/\b(?:with|give|include) (?:me )?(?:an |a )?example\b/.test(input)) return "exampled";
  return "plain";
}

function selectedMentions(mentions: ResolvedMention[]) {
  return mentions.filter(
    (mention): mention is ResolvedMention & { selected: NonNullable<ResolvedMention["selected"]> } =>
      Boolean(mention.selected),
  );
}

function entity(entityId: string): QueryTerm {
  return { kind: "entity", entityId };
}

function variable(name: string): QueryTerm {
  return { kind: "variable", name };
}

function text(value: string): QueryTerm {
  return { kind: "text", value };
}

function basePlan(
  original: string,
  normalized: string,
  relation: SemanticRelation | undefined,
): QueryPlan {
  const analysis = analyseSentence(original);
  const condition = normalized.match(/\b(?:if|provided that|assuming|when)\s+(.+)$/)?.[1];
  const temporal = normalized.match(
    /\b(?:today|yesterday|tomorrow|currently|now|before \d{4}|after \d{4}|in \d{4}|during [a-z0-9 -]+)\b/,
  )?.[0];
  return {
    id: `dv8-plan:${relation ?? "unresolved"}`,
    original,
    normalized,
    mode: analysis.mode,
    operation: "clarify",
    patterns: [],
    filters: [
      ...(temporal ? [{ kind: "time" as const, value: temporal }] : []),
      ...(condition
        ? [{ kind: "condition" as const, value: condition, negated: /\bnot\b/.test(condition) }]
        : []),
    ],
    negated: /\b(?:not|never|no|cannot)\b/.test(normalized.split(/\b(?:if|provided that|assuming|when)\b/)[0]),
    quantifier: /\b(?:all|every|each)\b/.test(normalized)
      ? "all"
      : /\b(?:none|no)\b/.test(normalized)
        ? "none"
        : /\b(?:any|some)\b/.test(normalized)
          ? "any"
          : undefined,
    temporal,
    condition,
    style: styleOf(normalized),
    subjectIds: [],
    unresolvedTerms: [],
    confidence: 0,
    evidence: [],
  };
}

function detectTransform(input: string, plan: QueryPlan): QueryPlan | undefined {
  const conversions = input.match(/^(?:convert|change)\s+(.+?)\s+(?:to|into)\s+([a-z]+)$/);
  if (conversions) {
    return {
      ...plan,
      operation: "transform",
      transform: { task: "convert", payload: `${conversions[1]}|${conversions[2]}` },
      confidence: 1,
      evidence: ["typed-transform:unit-conversion"],
    };
  }
  const taskPatterns: Array<[RegExp, NonNullable<QueryPlan["transform"]>["task"]]> = [
    [/^(?:sort|order)\s+(.+)/, "sort"],
    [/^(?:correct|fix) (?:the )?(?:grammar|sentence)(?: of| in)?\s*[:"]?(.+)/, "grammar"],
    [/^(?:summarize|sum up)\s*[:"]?\s*(.+)/, "summarize"],
    [/^(?:rewrite|rephrase)\s*[:"]?\s*(.+)/, "rewrite"],
    [/^(?:use|put)\s+(.+?)\s+in (?:a )?sentence/, "sentence"],
  ];
  const translation = input.match(/^translate\s+(.+?)\s+into\s+(spanish|french|english)/);
  if (translation) {
    return {
      ...plan,
      operation: "transform",
      transform: { task: "translate", payload: `${translation[1]} ${translation[2]}` },
      confidence: 1,
      evidence: ["typed-transform:translate"],
    };
  }
  for (const [pattern, task] of taskPatterns) {
    const payload = input.match(pattern)?.[1];
    if (payload) {
      if (task === "rewrite" && /^(?:that|this|it)$/.test(payload.trim())) return undefined;
      if (
        task === "summarize" &&
        !/\b(?:is|are|was|were|has|have|use|uses|make|makes|can|will|does|do)\b/.test(payload)
      ) return undefined;
      return {
        ...plan,
        operation: "transform",
        transform: { task, payload },
        confidence: 0.98,
        evidence: [`typed-transform:${task}`],
      };
    }
  }
  return undefined;
}

function objectTermFromTail(
  normalized: string,
  relation: SemanticRelation,
  mentions: ReturnType<typeof selectedMentions>,
): QueryTerm | undefined {
  const number = normalized.match(/\b(-?\d+(?:\.\d+)?)\s*([a-z]+)?\b/);
  if (number && ["leg_count", "atomic_number", "year", "birth_year", "founded_year", "size", "temperature"].includes(relation)) {
    return { kind: "number", value: Number(number[1]), unit: number[2] };
  }
  const verbTail: Partial<Record<SemanticRelation, RegExp>> = {
    ability: /\b(?:can|cannot|able to|capable of)\s+(?:a |an |the )?[a-z ]+?\s+(.+?)(?:\s+if\b|$)/,
    produces: /\b(?:produce|produces|make|makes)\s+(.+?)(?:\s+if\b|$)/,
    contains: /\b(?:contain|contains|have inside)\s+(.+?)(?:\s+if\b|$)/,
    diet: /\b(?:eat|eats)\s+(.+?)(?:\s+if\b|$)/,
    requires: /\b(?:need|needs|require|requires)\s+(.+?)(?:\s+if\b|$)/,
    has_part: /\b(?:have|has)\s+(.+?)(?:\s+if\b|$)/,
  };
  const tail = verbTail[relation] ? normalized.match(verbTail[relation]!)?.[1] : undefined;
  if (tail) return text(tail.replace(/^(?:a|an|the)\s+/, "").trim());
  const secondDistinct = mentions.slice(1).find(
    (mention) => mention.selected.entityId !== mentions[0]?.selected.entityId,
  );
  return secondDistinct ? entity(secondDistinct.selected.entityId) : undefined;
}

function classCandidate(mentions: ReturnType<typeof selectedMentions>) {
  return mentions.find((mention) => mention.selected.entityId.startsWith("class-"));
}

export function parseQueryPlan(
  input: string,
  lexicon: CompiledLexicalIndex,
  context: Dv8ParseContext = {},
): QueryPlan {
  const normalized = dv8Normalize(input);
  let relation = detectRelation(normalized);
  const plan = basePlan(input, normalized, relation);
  const transform = detectTransform(normalized, plan);
  if (transform) return transform;

  const mentions = lexicon.resolveMentions(normalized, relation);
  const ambiguous = mentions.find((mention) => !mention.selected && mention.senses.length > 1);
  if (ambiguous) {
    if (!relation) return { ...plan, confidence: 0 };
    return {
      ...plan,
      operation: "clarify",
      unresolvedTerms: [ambiguous.alias],
      evidence: ambiguous.senses.map((sense) => `sense:${sense.senseId}`),
      confidence: 1,
    };
  }

  let resolved = selectedMentions(mentions);
  if (/\b(?:it|its|they|their|them|that|this)\b/.test(normalized)) {
    const active = context.activeSubjectIds ?? [];
    const contextual = active.flatMap((entityId) => {
      const exact = lexicon.senses.find((sense) => sense.entityId === entityId);
      return exact
        ? [{ alias: "context", startToken: 999, endToken: 1000, selected: exact, senses: [exact], confidence: 0.95, reason: "contextual-sense" as const }]
        : [];
    });
    if (contextual.length) {
      const contextualIds = new Set(contextual.map((mention) => mention.selected.entityId));
      resolved = [
        ...contextual,
        ...resolved.filter((mention) => !contextualIds.has(mention.selected.entityId)),
      ];
      plan.evidence.push("dialogue:active-proposition-subject");
    }
  }
  if (/^(?:who|name the person)\b/.test(normalized) && resolved.length > 1) {
    resolved = resolved.filter((mention) => mention.selected.entityId !== "animal-human");
  }
  if (/^which countr(?:y|ies)\b/.test(normalized) && resolved.length > 1) {
    resolved = resolved.filter((mention) => mention.selected.entityId !== "topic-country");
  }
  if (relation === "importance" && resolved.length > 1) {
    resolved = resolved.filter((mention) => mention.selected.entityId !== "topic-matter");
  }
  plan.subjectIds = [...new Set(resolved.map((mention) => mention.selected.entityId))];
  const definitionTail = normalized
    .replace(/^(?:(?:what|who) (?:exactly )?(?:is|are|was|were)|(?:define|describe|introduce)|tell me about|give (?:me )?the definition of|state the definition of)\s+/, "")
    .replace(/^(?:a|an|the)\s+/, "")
    .trim();
  const exactDefinition = resolved.some((mention) => {
    const canonical = dv8Normalize(mention.selected.canonicalName).replace(/^(?:a|an|the)\s+/, "");
    return definitionTail === mention.alias || definitionTail === canonical;
  });
  if (exactDefinition) relation = "definition";
  if (plan.style === "exampled" && /\b(?:tell me about|explain)\b/.test(normalized)) {
    relation = "definition";
  }
  if (!relation && plan.quantifier && resolved.length >= 2) relation = "is_a";
  const propertyLabel = normalized.match(
    /^(?:(?:what|which) (?:is|are) (?:the )?|(?:give|state|identify) (?:me )?(?:the )?)(.+?) of\b/,
  )?.[1];
  const propertyLabelContainsSubject = Boolean(
    propertyLabel && resolved.some((mention) =>
      propertyLabel.includes(mention.alias) ||
      mention.alias.includes(propertyLabel) ||
      propertyLabel.includes(dv8Normalize(mention.selected.canonicalName)),
    ),
  );
  const propertyRelation = propertyLabel && !propertyLabelContainsSubject
    ? relationFromLabel(propertyLabel) ?? detectRelation(propertyLabel)
    : undefined;
  if (
    propertyLabel &&
    !propertyLabelContainsSubject &&
    !/\bcomparison\b/.test(propertyLabel) &&
    (!propertyRelation || /\b(?:favorite|favourite|shoe|personal|preferred)\b/.test(propertyLabel)) &&
    !exactDefinition
  ) {
    return {
      ...plan,
      operation: "clarify",
      subjectIds: plan.subjectIds,
      unresolvedTerms: [propertyLabel],
      confidence: 0.99,
      evidence: ["known-subject:unsupported-relation"],
    };
  }
  if (propertyRelation && !exactDefinition) relation = propertyRelation;
  if (
    relation === "related_to" &&
    /\b(?:they|their|them)\b/.test(normalized) &&
    (context.activeSubjectIds?.length ?? 0) !== 2
  ) {
    return {
      ...plan,
      operation: "clarify",
      subjectIds: [...(context.activeSubjectIds ?? [])],
      unresolvedTerms: ["plural reference"],
      confidence: 1,
      evidence: ["dialogue:ambiguous-subject-group"],
    };
  }

  // Inverse and two-hop selection plans are recognized before direct lookup.
  const citiesInRegion = /^which (?:cities|capitals).+countries? in\b/.test(normalized);
  if (citiesInRegion && resolved.length) {
    const region = resolved.at(-1)!.selected.entityId;
    return {
      ...plan,
      id: "dv8-plan:select-capitals-by-region",
      operation: "select",
      answerVariable: "city",
      patterns: [
        { subject: variable("country"), predicate: "continent", object: entity(region) },
        { subject: variable("country"), predicate: "capital", object: variable("city") },
      ],
      filters: plan.filters,
      subjectIds: [region],
      confidence: 0.96,
      evidence: [...plan.evidence, "query-plan:two-hop-inverse-join"],
    };
  }

  if (/^(?:which|what) countr(?:y|ies).+(?:capital|capital city)\b/.test(normalized) && resolved.length) {
    const city = resolved.at(-1)!.selected.entityId;
    return {
      ...plan,
      id: "dv8-plan:inverse-capital-country",
      operation: "select",
      answerVariable: "answer",
      patterns: [{ subject: variable("answer"), predicate: "capital", object: entity(city), inverse: true }],
      confidence: 0.98,
      evidence: [...plan.evidence, "query-plan:inverse-index"],
    };
  }

  const actorInverse = relation && inverseActorRelations.has(relation) && /^(?:what|which).+\b(?:did|by)\b/.test(normalized);
  if (actorInverse && resolved.length && /\b(?:did|has)\s+.+\s+(?:invent|write|create|discover|found)\b/.test(normalized)) {
    const actor = resolved[0].selected.entityId;
    return {
      ...plan,
      operation: "select",
      answerVariable: "answer",
      patterns: [{ subject: variable("answer"), predicate: relation!, object: entity(actor), inverse: true }],
      confidence: 0.95,
      evidence: [...plan.evidence, "query-plan:inverse-actor"],
    };
  }

  const countSelection = /^how many\b/.test(normalized) && /\b(?:countries|cities|animals|people|objects|planets)\b/.test(normalized);
  if (countSelection && resolved.length) {
    const target = resolved.at(-1)!.selected;
    const predicate: SemanticRelation = /\b(?:in|on)\b/.test(normalized) ? "continent" : "is_a";
    const requestedKind = /\bcountries\b/.test(normalized)
      ? "country"
      : /\bcities\b/.test(normalized)
        ? "place"
        : undefined;
    return {
      ...plan,
      operation: "aggregate",
      answerVariable: "answer",
      patterns: [{ subject: variable("answer"), predicate, object: entity(target.entityId), inverse: true }],
      filters: [
        ...plan.filters,
        ...(requestedKind
          ? [{ kind: "class" as const, variable: "answer", classId: `kind:${requestedKind}` }]
          : []),
      ],
      aggregate: { function: "count", variable: "answer" },
      confidence: 0.9,
      evidence: [...plan.evidence, "query-plan:count-aggregate"],
    };
  }

  const comparisonCue = /\b(?:compare|comparison|contrast|difference|versus|vs|which (?:is|has)|larger|smaller|bigger|higher|lower|same)\b/.test(normalized);
  if (comparisonCue && resolved.length >= 2) {
    if (/^(?:compare|contrast)\b/.test(normalized) && !/\b(?:by|in terms of|with respect to|based on|using|for their)\b/.test(normalized)) {
      relation = "definition";
    }
    relation ??= /\b(?:larger|smaller|bigger|higher|lower)\b/.test(normalized) ? "size" : "definition";
    const left = resolved[0].selected.entityId;
    const right = resolved[1].selected.entityId;
    const comparator = /\b(?:larger|bigger|higher|more)\b/.test(normalized)
      ? "greater"
      : /\b(?:smaller|lower|less)\b/.test(normalized)
        ? "less"
        : /\b(?:same|equal)\b/.test(normalized)
          ? "equal"
          : "different";
    return {
      ...plan,
      id: `dv8-plan:compare:${relation}`,
      operation: "compare",
      patterns: [
        { subject: entity(left), predicate: relation, object: variable("left") },
        { subject: entity(right), predicate: relation, object: variable("right") },
      ],
      comparator,
      confidence: 0.97,
      evidence: [...plan.evidence, "query-plan:typed-comparison", `relation:${relation}`],
    };
  }

  if (!relation || !resolved.length) {
    const unsupported = normalized.match(/^(?:what|which) (?:is|are) (?:the )?(.+?) of\b/)?.[1];
    return {
      ...plan,
      operation: "clarify",
      unresolvedTerms: unsupported ? [unsupported] : contentTokens(normalized).slice(0, 4),
      confidence: unsupported && resolved.length ? 0.92 : 0,
      evidence: [...plan.evidence, resolved.length ? "known-subject:unsupported-relation" : "no-resolved-subject"],
    };
  }

  const actorQuestion = inverseActorRelations.has(relation) && /^(?:who|name the person)\b/.test(normalized);
  const propertyOfQuestion = Boolean(propertyLabel && !propertyLabelContainsSubject);
  const subject = actorQuestion || propertyOfQuestion || (
    resolved.length > 1 &&
    !/^(?:is|are|do|does|did|can|could|has|have)\b/.test(normalized)
  )
    ? resolved.at(-1)!.selected.entityId
    : resolved[0].selected.entityId;
  const politeOpenRequest = /^(?:can|could|would|will) you (?:define|describe|explain|introduce|tell|give|state|identify)\b/.test(normalized);
  const booleanQuestion = !politeOpenRequest && /^(?:is|are|do|does|did|can|could|has|have)\b/.test(normalized);
  const quantifierClass = classCandidate(resolved);
  if (booleanQuestion || plan.quantifier) {
    let object = objectTermFromTail(normalized, relation, resolved);
    if (relation === "is_a" && resolved[1]) object = entity(resolved[1].selected.entityId);
    if (relation === "ability" && !object) {
      const quantifiedAction = normalized.match(
        /^(?:do|does)\s+(?:all|any|some|no)\s+.+?\s+(fly|swim|breathe|jump|run|produce|use(?:\s+.+)?)$/,
      )?.[1];
      const action = quantifiedAction ?? normalized
        .replace(/^(?:can|could)\s+(?:a |an |the )?/, "")
        .replace(new RegExp(`^${resolved[0].alias}\\s+`), "")
        .replace(/\s+(?:if|when)\b.+$/, "")
        .trim();
      if (action) object = text(action);
    }
    const quantified = plan.quantifier && quantifierClass;
    return {
      ...plan,
      id: `dv8-plan:ask:${relation}`,
      operation: "ask",
      patterns: [{
        subject: quantified ? variable("member") : entity(subject),
        predicate: relation,
        object: object ?? variable("value"),
      }],
      filters: [
        ...plan.filters,
        ...(quantified
          ? [{ kind: "class" as const, variable: "member", classId: quantifierClass.selected.entityId }]
          : []),
      ],
      answerVariable: quantified ? "member" : undefined,
      subjectIds: [subject],
      confidence: object ? 0.97 : 0.86,
      evidence: [...plan.evidence, "query-plan:three-valued-ask", `relation:${relation}`],
    };
  }

  return {
    ...plan,
    id: `dv8-plan:${actorQuestion ? "select-object" : "lookup"}:${relation}`,
    operation: actorQuestion ? "select" : "lookup",
    answerVariable: "answer",
    patterns: [{ subject: entity(subject), predicate: relation, object: variable("answer") }],
    subjectIds: [subject],
    confidence: 0.98,
    evidence: [...plan.evidence, "query-plan:typed-triple", `relation:${relation}`],
  };
}
