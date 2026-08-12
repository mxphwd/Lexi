import { dv11NormalizeText, dv11Number, normalizeDv11Request, stableHash } from "./normalize";
import { matchDv11CompiledLanguage } from "./compiled-language";
import { dv11KnowledgeStore, type Dv11KnowledgeStore } from "./store";
import type {
  Dv11AnswerShape,
  Dv11ClausePlan,
  Dv11Condition,
  Dv11ConfidenceComponents,
  Dv11Filter,
  Dv11Mention,
  Dv11NormalizedRequest,
  Dv11Operation,
  Dv11Pattern,
  Dv11QueryPlan,
  Dv11Quantifier,
  Dv11Relation,
  Dv11SourceSpan,
  Dv11SpeechAct,
  Dv11TemporalConstraint,
  Dv11Term,
} from "./types";

export type Dv11ParserContext = {
  activeEntityIds?: readonly string[];
  activeRelation?: string;
  previousAnswerShape?: Dv11AnswerShape;
  activeLexemeId?: string;
  activeLexemeLabel?: string;
  activeSenseIndex?: number;
};

export type Dv11ParserPlugin = {
  id: string;
  priority: number;
  supports(request: Dv11NormalizedRequest, clause: Dv11SourceSpan, context: Dv11ParserContext, store: Dv11KnowledgeStore): number;
  parse(request: Dv11NormalizedRequest, clause: Dv11SourceSpan, context: Dv11ParserContext, store: Dv11KnowledgeStore): Dv11ClausePlan[];
};

const relationFrames: ReadonlyArray<{ relation: Dv11Relation; property: string; patterns: RegExp[]; answerShape?: Dv11AnswerShape }> = [
  { relation: "procedure", property: "procedure", patterns: [/^how (?:do|can|should) (?:i|you|we|someone)\b/, /\bsteps? (?:to|for)\b/, /\bprocedure for\b/], answerShape: "procedure" },
  { relation: "state_transition", property: "state transition", patterns: [/\b(?:melt|melts|melted|freez(?:e|es|ing)|boil(?:s|ing)?|evaporat\w*)\b/], answerShape: "explanation" },
  { relation: "interesting_fact", property: "interesting fact", patterns: [/^(?:tell|give) me (?:something|a fact) interesting about\b/], answerShape: "text" },
  { relation: "is_a", property: "member", patterns: [/^(?:list|name|give(?: me)?)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|some|several)\s+[\p{L}\p{M}-]+s\b/u], answerShape: "entities" },
  { relation: "is_a", property: "negative classification", patterns: [/^what (?:is|are) not (?:a |an )?/], answerShape: "entity" },
  { relation: "count", property: "count", patterns: [/^how many\b/, /\bnumber of\b/], answerShape: "number" },
  { relation: "capital", property: "capital", patterns: [/\bcapitals?(?: city| cities)?\b/], answerShape: "entity" },
  { relation: "continent", property: "continent", patterns: [/\b(?:which|what) continent\b/, /\bcontinent (?:is|of)\b/], answerShape: "entity" },
  { relation: "country", property: "country", patterns: [/\bwhich country\b/, /\bwhat country\b/, /\bcountry of\b/], answerShape: "entity" },
  { relation: "currency", property: "currency", patterns: [/\bcurrency\b/, /\bwhat money\b/], answerShape: "text" },
  { relation: "language", property: "language", patterns: [/\blanguages?\b.*\bspoken\b/, /\bofficial languages?\b/, /\bwhat language\b/], answerShape: "text" },
  { relation: "location", property: "location", patterns: [/\bwhere (?:is|are|was|were)\b/, /\blocated\b/, /\blocation\b/], answerShape: "text" },
  { relation: "habitat", property: "habitat", patterns: [/\bwhere (?:do|does|did) .+ live\b/, /\bhabitat\b/], answerShape: "text" },
  { relation: "invented_by", property: "inventor", patterns: [/\bwho (?:was .+ )?invented\b/, /\binvented by\b/, /\bwhat did .+ invent\b/, /\b(?:person|person who|who) came up with\b/, /\binventor\b/], answerShape: "entity" },
  { relation: "created_by", property: "creator", patterns: [/\bwho created\b/, /\bcreated by\b/], answerShape: "entity" },
  { relation: "written_by", property: "author", patterns: [/\bwho wrote\b/, /\bwritten by\b/, /\bauthor of\b/], answerShape: "entity" },
  { relation: "discovered_by", property: "discoverer", patterns: [/\bwho discovered\b/, /\bdiscovered by\b/], answerShape: "entity" },
  { relation: "founded_by", property: "founder", patterns: [/\bwho founded\b/, /\bfounded by\b/], answerShape: "entity" },
  { relation: "founded_year", property: "founding year", patterns: [/\bwhen was .+ founded\b/, /\bfounding year\b/], answerShape: "number" },
  { relation: "birth_year", property: "birth year", patterns: [/\bwhen was .+ born\b/, /\bbirth year\b/], answerShape: "number" },
  { relation: "origin", property: "origin", patterns: [/\bwhen (?:was|were) .+ (?:invented|created|developed|started|introduced)\b/, /\borigin of\b/], answerShape: "text" },
  { relation: "known_for", property: "known for", patterns: [/\bknown for\b/, /\bfamous for\b/, /\bwhy is .+ famous\b/], answerShape: "explanation" },
  { relation: "importance", property: "importance", patterns: [/\bimportance\b/, /\bwhy (?:is|are) .+ important\b/, /^why should (?:i|we|people|someone) care about\b/, /\bwhy (?:should|do) .+ matter\b/], answerShape: "explanation" },
  { relation: "example", property: "example", patterns: [/\b(?:give|show) (?:me )?(?:an? )?example\b/, /\bexample of\b/], answerShape: "text" },
  { relation: "related_to", property: "relationship", patterns: [/\bhow (?:is|are) .+ related\b/, /\brelationship between\b/, /\brelated to\b/], answerShape: "explanation" },
  { relation: "purpose", property: "purpose", patterns: [/\bwhat is .+ for\b/, /\bpurpose\b/, /^why (?:do|does|is|are)\b/], answerShape: "explanation" },
  { relation: "mechanism", property: "mechanism", patterns: [/\bhow(?: exactly| precisely| generally| actually)? does .+ work\b/, /\bhow(?: exactly| precisely| generally| actually)? do .+ work\b/, /\bmechanism\b/], answerShape: "explanation" },
  { relation: "cause", property: "cause", patterns: [/\bwhat causes?\b/, /^why (?:did|does|do|is|are)\b/], answerShape: "explanation" },
  { relation: "effect", property: "effect", patterns: [/\bwhat happens\b/, /\beffect of\b/], answerShape: "explanation" },
  { relation: "cause", property: "cause", patterns: [/\bcause of\b/], answerShape: "explanation" },
  { relation: "composition", property: "composition", patterns: [/\bmade of\b/, /\bcomposed of\b/, /\bcomposition\b/], answerShape: "text" },
  { relation: "component", property: "component", patterns: [/\bcomponents? of\b/, /\bparts? of\b/, /\bwhat (?:parts|components)\b/], answerShape: "entities" },
  { relation: "has_part", property: "contents", patterns: [/\bcontents? of\b/], answerShape: "entities" },
  { relation: "part_of", property: "whole", patterns: [/\bpart of what\b/, /\bwhat is .+ part of\b/, /\bwhole of\b/], answerShape: "entity" },
  { relation: "requires", property: "requirements", patterns: [/\bwhat does .+ require\b/, /\bneeds? to\b/, /\brequires?\b/], answerShape: "entities" },
  { relation: "produces", property: "products", patterns: [/\bwhat does .+ produce\b/, /\bproduces?\b/], answerShape: "entities" },
  { relation: "ability", property: "ability", patterns: [/^can (?!you\b).+\b/, /\bable to\b/, /\bcapable of\b/], answerShape: "boolean" },
  { relation: "ability", property: "ability", patterns: [/^(?:do|does)\s+(?:all|any|some|most|each)?\s*.+\s+[\p{L}\p{M}-]+$/u], answerShape: "boolean" },
  { relation: "classification", property: "classification", patterns: [/\bwhat kind of\b/, /\bclassification\b/], answerShape: "entity" },
  { relation: "is_a", property: "classification", patterns: [/^(?:is|are|was|were)\b/], answerShape: "boolean" },
  { relation: "leg_count", property: "leg count", patterns: [/\bhow many legs\b/], answerShape: "number" },
  { relation: "atomic_number", property: "atomic number", patterns: [/\batomic number\b/], answerShape: "number" },
  { relation: "size", property: "size", patterns: [/\bhow (?:big|large|long|wide|tall)\b/, /\bsize of\b/, /\bdiameter\b/], answerShape: "quantity" },
  { relation: "temperature", property: "temperature", patterns: [/\btemperature\b/, /\bhow (?:hot|cold)\b/], answerShape: "quantity" },
  { relation: "lifespan", property: "lifespan", patterns: [/\bhow long (?:do|does) .+ live\b/, /\blifespan\b/], answerShape: "quantity" },
  { relation: "formula", property: "formula", patterns: [/\bformula\b/, /\bequation for\b/], answerShape: "text" },
  { relation: "symbol", property: "symbol", patterns: [/\bsymbol\b/], answerShape: "text" },
  { relation: "unit", property: "unit", patterns: [/\bunit of\b/, /\bmeasured in\b/], answerShape: "text" },
  { relation: "average_distance", property: "distance", patterns: [/\bhow far is .+ from\b/, /\bdistance (?:between|from)\b/], answerShape: "quantity" },
  { relation: "closest_to", property: "closest", patterns: [/\bclosest to\b/, /\bnearest to\b/], answerShape: "entity" },
  { relation: "borders", property: "border", patterns: [/\b(?:countries|nations) border\b/, /\bborders?\b/], answerShape: "entities" },
  { relation: "definition", property: "definition", patterns: [/^(?:what|who) (?:is|are|was|were)\b/, /^(?:define|describe|explain|tell me about)\b/, /^(?:can|could|would|will) you (?:define|describe|explain|tell me about)\b/, /\bmeaning of\b/], answerShape: "text" },
];

const defaultConfidence = (): Dv11ConfidenceComponents => ({
  normalization: 1,
  segmentation: 0.96,
  parsing: 0.55,
  entityLinking: 0,
  senseSelection: 0.5,
  routing: 0.5,
  evidence: 0,
  proof: 0,
  conflict: 1,
  realization: 0,
});

function speechAct(normalized: string): Dv11SpeechAct {
  if (/^(?:actually|no,?|i meant|correction|that is wrong|that was wrong)\b/.test(normalized)) return "correct";
  if (/^(?:forget|retract|ignore what i said)\b/.test(normalized)) return "retract";
  if (/^(?:what about|and what|how about|how do you know|why is that)\b/.test(normalized)) return "follow-up";
  if (/^(?:tell|give|show|list|name|define|explain|compare|calculate|find|sort|convert|remember)\b/.test(normalized)) return "request";
  if (/^(?:who|what|when|where|why|which|whose|how|is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b/.test(normalized)) return "ask";
  return "assert";
}

function mentionsFor(text: string, span: Dv11SourceSpan, store: Dv11KnowledgeStore): Dv11Mention[] {
  let knownMatches = store.findMentions(text);
  // In property-of frames, prefer the exact tail entity over a coincidental
  // longer alias such as “continent of Australia”. The property itself is
  // represented by the relation node, not by an entity mention.
  const propertyTail = /^(?:(?:state|give|show|tell me)\s+(?:the\s+)?[\p{L}\p{M}_ -]+|what (?:is|are|was|were) the [\p{L}\p{M}_ -]+)\s+(?:of|for|from|in)\b/u.test(text)
    ? text.match(/\b(?:of|for|from|in)\s+(?:the\s+)?([^?.!]+)[?.!]*$/u)
    : undefined;
  if (propertyTail?.[1]) {
    const tailText = propertyTail[1].trim();
    const candidates = store.resolveExact(tailText);
    const tailStart = text.lastIndexOf(tailText);
    if (candidates.length && tailStart >= 0) {
      knownMatches = knownMatches.filter((match) => !(match.start < tailStart && match.end > tailStart));
      knownMatches.push({ start: tailStart, end: tailStart + tailText.length, text: tailText, candidates });
    }
  }
  const ignoredNames = new Set(["what", "who", "when", "where", "why", "which", "how", "is", "are", "can", "could", "would", "will", "please", "tell", "give", "show", "list", "name", "define", "explain", "if", "actually"]);
  const unknownMatches = [...text.matchAll(/\b[\p{Lu}][\p{L}\p{M}'-]*(?:\s+[\p{Lu}][\p{L}\p{M}'-]*){0,4}\b/gu)].flatMap((match) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (ignoredNames.has(dv11NormalizeText(match[0])) || knownMatches.some((known) => start < known.end && end > known.start)) return [];
    return [{ start, end, text: match[0], candidates: [{ entityId: `unlinked:${stableHash(match[0])}`, canonicalName: match[0], kind: "unknown" as const, alias: match[0], score: 0.25, evidence: ["unlinked-named-entity"] }] }];
  });
  const nonOverlapping = [...knownMatches, ...unknownMatches]
    .sort((left, right) => (right.end - right.start) - (left.end - left.start) || left.start - right.start)
    .reduce<ReturnType<Dv11KnowledgeStore["findMentions"]>>((selected, candidate) => {
      if (!selected.some((item) => candidate.start < item.end && candidate.end > item.start)) selected.push(candidate);
      return selected;
    }, [])
    .sort((left, right) => left.start - right.start);
  const contextTokens = new Set(dv11NormalizeText(text).match(/[\p{L}\p{N}-]+/gu) ?? []);
  return nonOverlapping.map((match, index) => {
    const senses = match.candidates.flatMap((candidate) => store.sensesForEntity(candidate.entityId)).map((sense) => {
      const features = sense.contextualFeatures ?? [];
      const hits = features.filter((feature) => contextTokens.has(dv11NormalizeText(feature))).length;
      return { ...sense, score: Math.min(1, sense.score * 0.5 + hits * 0.25), evidence: [...sense.evidence, ...features.filter((feature) => contextTokens.has(dv11NormalizeText(feature))).map((feature) => `context:${feature}`)] };
    }).sort((left, right) => right.score - left.score);
    const selectedSense = senses[0] && (senses.length === 1 || senses[0].score > senses[1].score + 0.05) ? senses[0] : undefined;
    return {
      id: `mention:${span.start + match.start}:${index}`,
      span: { start: span.start + match.start, end: span.start + match.end, text: match.text },
      grammaticalRole: "unknown" as const,
      number: /s$/.test(match.text) ? "plural" as const : "singular" as const,
      candidates: selectedSense ? match.candidates.filter((candidate) => candidate.entityId === selectedSense.entityId) : match.candidates,
      senses,
      selectedEntityId: selectedSense?.entityId ?? (match.candidates.length === 1 && match.candidates[0].kind !== "unknown" ? match.candidates[0].entityId : undefined),
      selectedSenseId: selectedSense?.senseId,
    };
  });
}

function relationCandidates(normalized: string) {
  return relationFrames
    .map((frame, index) => ({
      frame,
      score: frame.patterns.some((pattern) => pattern.test(normalized)) ? 1_000 - index * 4
        + frame.patterns.reduce((best, pattern) => pattern.test(normalized) ? Math.max(best, pattern.source.length / 100) : best, 0) : 0
        + (frame.property === "negative classification" && /^what (?:is|are) not\b/.test(normalized) ? 1_000 : 0),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
}

function quantifiers(normalized: string, variable = "answer"): Dv11Quantifier[] {
  const exact = normalized.match(/\bexactly\s+([\p{L}\p{N}-]+)\b/u);
  const minimum = normalized.match(/\b(?:at least|no fewer than)\s+([\p{L}\p{N}-]+)\b/u);
  const maximum = normalized.match(/\b(?:at most|no more than)\s+([\p{L}\p{N}-]+)\b/u);
  const exactCount = exact ? dv11Number(exact[1]) : undefined;
  const minimumCount = minimum ? dv11Number(minimum[1]) : undefined;
  const maximumCount = maximum ? dv11Number(maximum[1]) : undefined;
  if (exactCount !== undefined) return [{ kind: "exact", variable, cardinality: exactCount }];
  if (minimumCount !== undefined) return [{ kind: "minimum", variable, cardinality: minimumCount }];
  if (maximumCount !== undefined) return [{ kind: "maximum", variable, cardinality: maximumCount }];
  for (const kind of ["all", "any", "none", "some", "each", "most"] as const) {
    if (new RegExp(`\\b${kind}\\b`).test(normalized)) return [{ kind, variable }];
  }
  return [];
}

function temporalConstraints(normalized: string): Dv11TemporalConstraint[] {
  if (/\b(?:currently|now|today|presently)\b/.test(normalized)) return [{ kind: "current" }];
  const range = normalized.match(/\b(?:between|from)\s+(\d{4})\s+(?:and|to)\s+(\d{4})\b/);
  if (range) return [{ kind: "interval", from: range[1], to: range[2] }];
  const before = normalized.match(/\bbefore\s+([^,?.]+)$/)?.[1];
  if (before) return [{ kind: "before", value: before }];
  const after = normalized.match(/\bafter\s+([^,?.]+)$/)?.[1];
  if (after) return [{ kind: "after", value: after }];
  const point = normalized.match(/\b(?:in|during|on|at)\s+(\d{4}|today|yesterday|tomorrow)\b/)?.[1];
  if (point) return [{ kind: "point", value: point }];
  if (/\b(?:historically|in the past|used to)\b/.test(normalized)) return [{ kind: "historical" }];
  const recurrence = normalized.match(/\b(?:every|each)\s+(day|week|month|year|[a-z]+day)\b/)?.[1];
  return recurrence ? [{ kind: "recurring", recurrence }] : [];
}

function answerShape(normalized: string, relationShape?: Dv11AnswerShape): Dv11AnswerShape {
  if (/^(?:is|are|was|were|do|does|did|can|could|has|have|had|will|would|should)\b/.test(normalized)) return "boolean";
  if (/^how many\b/.test(normalized)) return "number";
  if (/^(?:list|name|give me|which)\b/.test(normalized) && /\b(?:countries|people|animals|planets|members|examples|parts|components)\b/.test(normalized)) return "entities";
  if (/^how (?:far|big|large|long|wide|tall|hot|cold|old|much)\b/.test(normalized)) return "quantity";
  if (/^(?:why|how does|how do|explain)\b/.test(normalized)) return "explanation";
  return relationShape ?? "text";
}

function requestedCount(normalized: string) {
  const match = normalized.match(/^(?:list|name|give(?: me)?)\s+([\p{L}\p{N}-]+)\b/u)
    ?? normalized.match(/\b(?:top|bottom|first|last)\s+([\p{L}\p{N}-]+)\b/u);
  return match ? dv11Number(match[1]) : undefined;
}

function ordinal(normalized: string) {
  const numeric = normalized.match(/\b(\d+)(?:st|nd|rd|th)\b/)?.[1];
  if (numeric) return Number(numeric);
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  const word = normalized.match(/\b(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(?:closest|nearest|largest|smallest|highest|lowest|oldest|youngest|item|result|member|one)\b/)?.[1];
  return word ? words[word] : undefined;
}

function relationTerms(normalized: string, relation: Dv11Relation, mentions: Dv11Mention[], context: Dv11ParserContext) {
  const selected = mentions.flatMap((mention) => mention.selectedEntityId ? [{ mention, entityId: mention.selectedEntityId }] : []);
  const entity = (entityId: string): Dv11Term => ({ kind: "entity", entityId });
  const answer: Dv11Term = { kind: "variable", name: "answer", expectedKind: "any" };
  let subject: Dv11Term = selected[0] ? entity(selected[0].entityId) : answer;
  let object: Dv11Term = answer;
  let answerVariable = "answer";

  if (relation === "procedure" && selected.length) {
    subject = entity(selected.at(-1)!.entityId);
  } else if (/^(?:state|give|show|tell me)\s+(?:the\s+)?[\p{L}\p{M}_ -]+\s+of\b/u.test(normalized) && selected.length) {
    subject = entity(selected.at(-1)!.entityId);
    object = answer;
  } else if (relation === "purpose" && /\bhumans?\s+sleep\b/.test(normalized) && selected.length > 1) {
    subject = entity(selected.at(-1)!.entityId);
  } else if (relation === "borders" && /^(?:what|which)\s+(?:countries|nations)\s+border\b/.test(normalized) && selected.length) {
    subject = entity(selected.at(-1)!.entityId);
    object = answer;
  } else if (relation === "invented_by" && /\bcame up with\b/.test(normalized) && selected.length) {
    subject = entity(selected.at(-1)!.entityId);
    object = answer;
  } else if (relation === "capital" && /^which cities are capitals? of countries in\b/.test(normalized)) {
    subject = { kind: "variable", name: "country", expectedKind: "entity" };
    object = answer;
  } else if (relation === "continent" && /^what continent is .+ in\b/.test(normalized) && selected.length) {
    subject = entity(selected.at(-1)!.entityId);
    object = answer;
  } else if (relation === "count" && /\b(?:in|of|within)\b/.test(normalized) && selected.length > 1) {
    subject = entity(selected.at(-1)!.entityId);
  } else if (/^(?:list|name|give(?: me)?)\b/.test(normalized) && relation === "is_a" && selected[0]) {
    subject = answer;
    object = entity(selected[0].entityId);
  } else if (/^what (?:is|are) not\b/.test(normalized) && relation === "is_a" && selected[0]) {
    subject = answer;
    object = entity(selected[0].entityId);
  } else if (/\b(?:which|what) country has\b/.test(normalized) && selected[0]) {
    subject = answer;
    object = entity(selected[0].entityId);
  } else if (/^what did\b/.test(normalized) && selected[0] && ["invented_by", "created_by", "written_by", "discovered_by", "founded_by"].includes(relation)) {
    subject = answer;
    object = entity(selected[0].entityId);
  } else if (/^who\b/.test(normalized) && selected[0] && ["invented_by", "created_by", "written_by", "discovered_by", "founded_by"].includes(relation)) {
    subject = entity(selected[0].entityId);
    object = answer;
  } else if (relation === "closest_to") {
    const target = selected.at(-1);
    const classMention = selected.length > 1 ? selected[0] : undefined;
    subject = classMention ? entity(classMention.entityId) : { kind: "text", value: normalized.match(/^which\s+(.+?)\s+is\s+(?:the\s+)?(?:closest|nearest)/)?.[1] ?? "item" };
    object = answer;
    return { subject, object, answerVariable, targetEntityId: target?.entityId, targetText: normalized.match(/(?:closest|nearest) to (?:the )?(.+)$/)?.[1] };
  } else if (relation === "average_distance") {
    const [left, right] = selected;
    subject = left ? entity(left.entityId) : { kind: "text", value: normalized.match(/^how far is (.+?) from/)?.[1] ?? "subject" };
    object = answer;
    return { subject, object, answerVariable, targetEntityId: right?.entityId, targetText: normalized.match(/ from (?:the )?(.+)$/)?.[1] };
  } else if (/^(?:is|are|was|were)\b/.test(normalized) && selected.length >= 2) {
    subject = entity(selected[0].entityId);
    object = entity(selected[1].entityId);
    answerVariable = undefined as unknown as string;
  } else if (!selected.length && context.activeEntityIds?.length && /^(?:it|they|them|that|those|this|these|what about|and what|how about)\b/.test(normalized)) {
    subject = entity(context.activeEntityIds[0]);
  }
  return { subject, object, answerVariable };
}

function operationFor(normalized: string, shape: Dv11AnswerShape, speech: Dv11SpeechAct): Dv11Operation {
  if (/^(?:how do you know|what supports that|show (?:me )?(?:the )?proof)\b/.test(normalized)) return "explain-proof";
  if (speech === "retract") return "retract";
  if (speech === "correct") return "correct";
  if (/\b(?:calculate|compute|plus|minus|times|multiplied|divided|percent|average of|sum of)\b/.test(normalized)) return "calculate";
  if (/^(?:remember|my name is|call me|i am \d+\s+years? old|i live in|i am from|i like|i prefer)\b/.test(normalized)) return "remember";
  if (/^(?:what is my|who am i|how old am i|where do i live|what do i like)\b/.test(normalized)) return "recall";
  if (/\b(?:compare|contrast|difference between|larger|smaller|greater|less|older|younger)\b/.test(normalized)) return "compare";
  if (/^how many\b/.test(normalized)) return "aggregate";
  if (shape === "boolean") return "verify";
  return "select";
}

function conditionGraph(normalized: string, fallbackPattern: Dv11Pattern): Dv11Condition[] {
  if (/^what happens when\b/.test(normalized)) return [];
  const leading = normalized.match(/^(?:if|assuming|provided that)\s+(.+?),\s*(.+)$/);
  const trailing = normalized.match(/^(.+?)\s+(?:if|when|provided that)\s+(.+)$/);
  const premise = (leading?.[1] ?? trailing?.[2])?.replace(/[?.!]+$/, "").trim();
  if (!premise) return [];
  return [{
    kind: "if",
    premise: { kind: "counterfactual", premiseText: premise },
    consequence: { kind: "proposition", pattern: fallbackPattern },
  }];
}

function genericPlans(request: Dv11NormalizedRequest, clause: Dv11SourceSpan, context: Dv11ParserContext, store: Dv11KnowledgeStore): Dv11ClausePlan[] {
  const normalized = dv11NormalizeText(clause.text);
  const detected = relationCandidates(normalized);
  const openProperty = normalized.match(/^(?:what|who) (?:is|are|was|were) the (.+?) (?:of|for|from|in)\b/)?.[1];
  const unsupportedCompoundProperty = openProperty && /\b(?:shoe|favorite|preferred|personal)\b/.test(openProperty);
  if (openProperty && (unsupportedCompoundProperty || !detected.some((item) => !["definition", "is_a"].includes(item.frame.relation)))) {
    detected.unshift({ frame: { relation: `property:${openProperty.replace(/[^\p{L}\p{N}]+/gu, "_")}`, property: openProperty, patterns: [], answerShape: "text" }, score: 1_500 });
  }
  const mentions = mentionsFor(normalized, clause, store);
  const frames = detected.length ? detected.slice(0, 3) : [{ frame: { relation: context.activeRelation ?? "definition", property: context.activeRelation ?? "definition", patterns: [] }, score: 0 }];
  return frames.map(({ frame, score }, alternativeIndex) => {
    const unmarkedLexicalAmbiguity = /^what does .+ mean[?.!]*$/.test(normalized) && !/\b(?:in|as used in|context of)\b/.test(normalized);
    const scopedMentions = mentions.map((mention) => {
      if (unmarkedLexicalAmbiguity && mention.senses.length > 1) {
        const candidates = [...new Map(mention.senses.map((sense) => {
          const entity = store.entity(sense.entityId);
          return [sense.entityId, {
            entityId: sense.entityId,
            canonicalName: entity?.canonicalName ?? sense.lemma,
            kind: entity?.kind ?? "unknown" as const,
            alias: sense.lemma,
            score: sense.score,
            evidence: [...sense.evidence, "unmarked-word-sense"],
          }];
        })).values()];
        return { ...mention, candidates, selectedEntityId: undefined, selectedSenseId: undefined };
      }
      if (mention.selectedEntityId || mention.candidates.length < 2) return mention;
      const supported = mention.candidates.filter((candidate) => store.direct(candidate.entityId, frame.relation).length > 0);
      return supported.length === 1
        ? { ...mention, selectedEntityId: supported[0].entityId, candidates: [supported[0]] }
        : mention;
    });
    const shape = answerShape(normalized, frame.answerShape);
    const speech = speechAct(normalized);
    const terms = relationTerms(normalized, frame.relation, scopedMentions, context);
    const roleMentions = scopedMentions.map((mention) => {
      const id = mention.selectedEntityId;
      const role = id && terms.subject.kind === "entity" && terms.subject.entityId === id
        ? "subject" as const
        : id && terms.object.kind === "entity" && terms.object.entityId === id
          ? "direct-object" as const
          : "modifier" as const;
      return { ...mention, grammaticalRole: role };
    });
    const pattern: Dv11Pattern = {
      id: `${request.id}:pattern:${clause.start}:${alternativeIndex}`,
      subject: terms.subject,
      relation: frame.relation,
      object: terms.object,
      optional: false,
      negated: speech !== "correct" && /\b(?:not|never|no|without|does not|do not|is not|are not)\b/.test(normalized),
    };
    const patterns: Dv11Pattern[] = [pattern];
    if (frame.relation === "capital" && /^which cities are capitals? of countries in\b/.test(normalized)) {
      const regionId = scopedMentions.map((mention) => mention.selectedEntityId).find((entityId) => entityId && store.entity(entityId)?.kind === "region");
      if (regionId) patterns.push({
        id: `${request.id}:pattern:${clause.start}:${alternativeIndex}:region`,
        subject: { kind: "variable", name: "country", expectedKind: "entity" },
        relation: "continent",
        object: { kind: "entity", entityId: regionId },
        optional: false,
        negated: false,
      });
    }
    const filters: Dv11Filter[] = [];
    if (frame.relation === "ability") {
      const ability = normalized.match(/^(?:do|does)\s+(?:(?:all|any|some|most|each)\s+)?(?:.+?)\s+([\p{L}\p{M}-]+)$/u)?.[1]
        ?? normalized.match(/^can\s+(?:.+?)\s+([\p{L}\p{M}-]+)$/u)?.[1];
      if (ability) filters.push({ kind: "condition", expression: { kind: "counterfactual", premiseText: ability } });
    }
    if (terms.targetEntityId) filters.push({ kind: "condition", expression: { kind: "counterfactual", premiseText: `target:${terms.targetEntityId}` } });
    else if (terms.targetText) filters.push({ kind: "condition", expression: { kind: "counterfactual", premiseText: `target:${terms.targetText}` } });
    const quantity = requestedCount(normalized);
    const requestedOrdinal = ordinal(normalized);
    const unresolvedSlots: string[] = [];
    if (
      pattern.subject.kind === "variable" &&
      operationFor(normalized, shape, speech) !== "aggregate" &&
      !["member", "negative classification"].includes(frame.property)
    ) unresolvedSlots.push("subject");
    if (scopedMentions.some((mention) => mention.candidates.length > 1 && !mention.selectedEntityId)) unresolvedSlots.push("entity-sense");
    if (/^what (?:is|are) not\b/.test(normalized) && pattern.subject.kind === "variable") unresolvedSlots.push("universe");
    const confidence = defaultConfidence();
    confidence.parsing = Math.min(0.96, 0.48 + score / 140);
    confidence.entityLinking = scopedMentions.length ? scopedMentions.reduce((sum, mention) => sum + Math.max(0, ...mention.candidates.map((candidate) => candidate.score)), 0) / scopedMentions.length : pattern.subject.kind === "text" ? 0.45 : 0.25;
    confidence.routing = detected.length ? Math.max(0.55, 0.92 - alternativeIndex * 0.16) : 0.25;
    return {
      id: `${request.id}:clause:${clause.start}:${frame.relation}:${alternativeIndex}`,
      source: clause,
      speechAct: speech,
      operation: operationFor(normalized, shape, speech),
      mode: request.mode,
      requestedProperty: frame.property,
      answerVariable: terms.answerVariable,
      answerShape: shape,
      mentions: roleMentions,
      patterns,
      filters,
      quantifiers: quantifiers(normalized),
      temporal: temporalConstraints(normalized),
      conditions: conditionGraph(normalized, pattern),
      order: /\b(?:largest|highest|most|oldest|greatest|top)\b/.test(normalized)
        ? [{ variable: "answer", direction: "descending", ordinal: requestedOrdinal }]
        : /\b(?:smallest|lowest|least|youngest|closest|nearest|bottom)\b/.test(normalized)
          ? [{ variable: "answer", direction: "ascending", ordinal: requestedOrdinal }]
          : requestedOrdinal
            ? [{ variable: "answer", direction: "ascending", ordinal: requestedOrdinal }]
            : [],
      offset: requestedOrdinal ? requestedOrdinal - 1 : 0,
      limit: quantity ?? (requestedOrdinal ? 1 : undefined),
      negated: pattern.negated,
      unresolvedSlots: [...new Set(unresolvedSlots)],
      evidence: [`frame:${frame.relation}`, ...scopedMentions.flatMap((mention) => mention.candidates.flatMap((candidate) => candidate.evidence))],
      confidence,
      pluginId: "compositional-general",
    };
  });
}

const arithmeticPlugin: Dv11ParserPlugin = {
  id: "deterministic-arithmetic",
  priority: 100,
  supports(_request, clause) {
    return /\b(?:plus|minus|times|multiplied|divided|percent|average|sum|calculate|compute)\b/i.test(clause.text)
      || /\b(?:i|we)\s+have\s+.+\b(?:buy|bought|get|got|receive|received|lose|lost|use|used)\s+.+\bhow many\b/i.test(clause.text)
      ? 1 : 0;
  },
  parse(request, clause) {
    const normalized = dv11NormalizeText(clause.text);
    const plan = genericPlans(request, clause, {}, dv11KnowledgeStore)[0];
    return [{
      ...plan,
      operation: "calculate",
      answerShape: "number",
      patterns: [],
      unresolvedSlots: [],
      evidence: [...plan.evidence, `expression:${normalized}`],
      pluginId: "deterministic-arithmetic",
      confidence: { ...plan.confidence, parsing: 0.94, routing: 0.98 },
    }];
  },
};

const logicPlugin: Dv11ParserPlugin = {
  id: "deterministic-logic",
  priority: 105,
  supports(_request, clause) {
    const normalized = dv11NormalizeText(clause.text);
    return /^(?:if|suppose) (?:every|all) .+ (?:is|are) .+ and (?:every|all) .+ (?:is|are) .+[,;]? (?:is|are) (?:every|all) /i.test(normalized) ? 1 : 0;
  },
  parse(request, clause, context, store) {
    const plan = genericPlans(request, clause, context, store)[0];
    return [{ ...plan, operation: "infer", answerShape: "boolean", patterns: [], unresolvedSlots: [], evidence: [...plan.evidence, `logic:${dv11NormalizeText(clause.text)}`], pluginId: "deterministic-logic", confidence: { ...plan.confidence, parsing: 0.97, routing: 0.99 } }];
  },
};

const compiledLexicalPlugin: Dv11ParserPlugin = {
  id: "compiled-lexical-language",
  priority: 102,
  supports(_request, clause, context) {
    const matched = matchDv11CompiledLanguage(clause.text, context);
    return matched ? matched.evidence.some((item) => item.startsWith("compiled-dialogue:")) ? 1.1 : 0.99 : 0;
  },
  parse(request, clause, context, store) {
    const matched = matchDv11CompiledLanguage(clause.text, context);
    if (!matched) return [];
    const plan = genericPlans(request, clause, context, store)[0];
    if (matched.contextHint && plan.mentions.some((mention) => mention.selectedSenseId)) {
      return [{ ...plan, evidence: [...plan.evidence, ...matched.evidence, "curated-world-sense-preferred"], pluginId: "compositional-general" }];
    }
    return [{
      ...plan,
      operation: "lexical",
      answerShape: matched.operation === "list-senses" ? "entities" : matched.operation === "recall-topic" ? "text" : "text",
      patterns: [],
      filters: [],
      quantifiers: [],
      temporal: [],
      conditions: [],
      order: [],
      offset: 0,
      limit: undefined,
      negated: false,
      unresolvedSlots: [],
      lexicalRequest: { operation: matched.operation, term: matched.term, contextHint: matched.contextHint, requestedSense: matched.requestedSense },
      evidence: [...plan.evidence, ...matched.evidence, `lexeme:${matched.term}`],
      pluginId: "compiled-lexical-language",
      confidence: { ...plan.confidence, parsing: 0.97, routing: 0.99, entityLinking: 0.9, senseSelection: matched.contextHint ? 0.92 : 0.78 },
    }];
  },
};

const dialoguePlugin: Dv11ParserPlugin = {
  id: "dialogue-memory",
  priority: 110,
  supports(_request, clause) {
    return /^(?:how do you know|what supports that|show (?:me )?(?:the )?proof|what is my|who am i|how old am i|where do i live|what do i like|my name is|i am \d+|i live in|i like|actually|no,? i meant|i meant|that is wrong|that was wrong|forget)\b/i.test(dv11NormalizeText(clause.text)) ? 1 : 0;
  },
  parse(request, clause, context, store) {
    const plan = genericPlans(request, clause, context, store)[0];
    const normalized = dv11NormalizeText(clause.text);
    const operation: Dv11Operation = /^(?:how do you know|what supports that|show (?:me )?(?:the )?proof)/.test(normalized)
      ? "explain-proof"
      : /^(?:forget|retract|ignore what i said)/.test(normalized)
        ? "retract"
        : /^(?:actually|no,?|i meant|correction|that is wrong|that was wrong)/.test(normalized)
          ? "correct"
      : /^(?:what is my|who am i|how old am i|where do i live|what do i like)/.test(normalized)
        ? "recall"
        : "remember";
    return [{ ...plan, operation, patterns: [], answerShape: operation === "explain-proof" ? "proof" : "text", unresolvedSlots: [], pluginId: "dialogue-memory", confidence: { ...plan.confidence, parsing: 0.96, routing: 0.98 } }];
  },
};

const generalPlugin: Dv11ParserPlugin = {
  id: "compositional-general",
  priority: 10,
  supports() { return 0.5; },
  parse: genericPlans,
};

const plugins: Dv11ParserPlugin[] = [dialoguePlugin, logicPlugin, compiledLexicalPlugin, arithmeticPlugin, generalPlugin];

export function registerDv11ParserPlugin(plugin: Dv11ParserPlugin) {
  if (plugins.some((candidate) => candidate.id === plugin.id)) throw new Error(`Parser plugin ${plugin.id} already exists.`);
  plugins.push(plugin);
  plugins.sort((left, right) => right.priority - left.priority);
}

export function parseDv11Query(
  original: string,
  context: Dv11ParserContext = {},
  store: Dv11KnowledgeStore = dv11KnowledgeStore,
  limits = { maximumCharacters: 12_000, maximumTokens: 2_000, maximumClauses: 64, maximumOperations: 256 },
): { request: Dv11NormalizedRequest; plan: Dv11QueryPlan } {
  const request = normalizeDv11Request(original, limits);
  const clauses: Dv11ClausePlan[] = [];
  const alternatives: Dv11QueryPlan["alternatives"] = [];
  for (const clause of request.clauses) {
    const rankedPlugins = plugins
      .map((plugin) => ({ plugin, score: plugin.supports(request, clause, context, store) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || right.plugin.priority - left.plugin.priority);
    const parsed = rankedPlugins[0]?.plugin.parse(request, clause, context, store) ?? [];
    const rankedPlans = parsed.sort((left, right) => {
      const leftScore = left.confidence.parsing * left.confidence.entityLinking * left.confidence.routing;
      const rightScore = right.confidence.parsing * right.confidence.entityLinking * right.confidence.routing;
      return rightScore - leftScore;
    });
    const selected = rankedPlans[0];
    if (selected) clauses.push(selected);
    if (rankedPlans.length > 1) alternatives.push({ clauseId: selected.id, plans: rankedPlans.slice(1) });
  }
  return {
    request,
    plan: {
      id: `plan:${stableHash(`${request.id}:${request.normalized}`)}`,
      original,
      normalized: request.normalized,
      clauses,
      alternatives,
      dialogueReferences: [],
      createdAt: new Date(0).toISOString(),
    },
  };
}

export function dv11ParserStats() {
  return { plugins: plugins.map((plugin) => plugin.id), relationFrames: relationFrames.length, typedPlanFields: 18 };
}
