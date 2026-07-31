import { prepareLinguisticInput } from "@/modules/extended-pack";
import { normalizeText } from "@/modules/search/tokenize";
import { relationFromLabel } from "./frames";
import type {
  SemanticEntityMention,
  SemanticParseContext,
  SemanticQuery,
  SemanticQuestionKind,
  SemanticRelation,
  SemanticResolver,
} from "./types";

type RelationDetection = {
  relation: SemanticRelation;
  kind?: SemanticQuestionKind;
  ability?: string;
  objectText?: string;
  evidence: string[];
};

const comparisonCue =
  /\b(?:compare|comparison|contrast|difference|different|differ|similar|similarity|versus|vs|which (?:one )?is|which has|which uses)\b/;

const relationDetectors: Array<{
  relation: SemanticRelation;
  patterns: RegExp[];
}> = [
  {
    relation: "leg_count",
    patterns: [
      /\bhow many (?:legs|limbs)\b/,
      /\b(?:leg|limb) count\b/,
      /\bnumber of (?:legs|limbs)\b/,
    ],
  },
  {
    relation: "atomic_number",
    patterns: [/\batomic number\b/, /\bnumber on the periodic table\b/],
  },
  {
    relation: "invented_by",
    patterns: [/\bwho invented\b/, /\binventor\b/, /\binvented by\b/],
  },
  {
    relation: "discovered_by",
    patterns: [/\bwho discovered\b/, /\bdiscoverer\b/, /\bdiscovered by\b/],
  },
  {
    relation: "created_by",
    patterns: [/\bwho created\b/, /\bcreator\b/, /\bcreated by\b/, /\bwho made\b/],
  },
  {
    relation: "written_by",
    patterns: [/\bwho wrote\b/, /\bwritten by\b/, /\bauthor of\b/, /\bwho authored\b/],
  },
  {
    relation: "known_for",
    patterns: [
      /\bwhat (?:is|was) .+ (?:known|famous) for\b/,
      /\bwhy (?:is|was) .+ famous\b/,
      /\bknown for\b/,
      /\bfamous for\b/,
      /\bmain contribution\b/,
    ],
  },
  {
    relation: "founded_by",
    patterns: [/\bwho founded\b/, /\bfounded by\b/, /\bfounder of\b/],
  },
  {
    relation: "founded_year",
    patterns: [/\bwhen was .+ founded\b/, /\bfounding year\b/, /\bfounded when\b/],
  },
  {
    relation: "birth_year",
    patterns: [/\bwhen was .+ born\b/, /\bbirth year\b/, /\byear of birth\b/],
  },
  {
    relation: "nationality",
    patterns: [/\bwhat nationality\b/, /\bnationality of\b/, /\bwhich country was .+ from\b/],
  },
  {
    relation: "formula",
    patterns: [/\bwhat is the formula\b/, /\bformula for\b/, /\bequation for\b/],
  },
  {
    relation: "unit",
    patterns: [/\bwhat (?:is the )?unit\b/, /\bunit of\b/, /\bmeasured in\b/],
  },
  {
    relation: "capital",
    patterns: [/\bcapital(?: city)?\b/],
  },
  {
    relation: "continent",
    patterns: [/\bwhich continent\b/, /\bwhat continent\b/, /\bcontinent of\b/],
  },
  {
    relation: "country",
    patterns: [
      /^what country (?:is|are)\b/,
      /\bwhich country\b/,
      /\bcountry of\b/,
    ],
  },
  {
    relation: "currency",
    patterns: [
      /^what currency (?:does|do)\b/,
      /\bcurrency\b/,
      /\bwhat money\b/,
      /\bkind of money\b/,
    ],
  },
  {
    relation: "language",
    patterns: [
      /\bwhat language\b/,
      /\bwhich language\b/,
      /\bofficial languages?\b/,
      /\blanguage.*spoken\b/,
    ],
  },
  {
    relation: "habitat",
    patterns: [
      /\bwhere (?:do|does) .+ live\b/,
      /\bwhere .+ lives?\b/,
      /\bhabitat\b/,
      /\bnatural home\b/,
    ],
  },
  {
    relation: "diet",
    patterns: [
      /\bwhat (?:do|does) .+ eat\b/,
      /\bwhat .+ eats?\b/,
      /\bdiet\b/,
      /\bfood does\b/,
    ],
  },
  {
    relation: "lifespan",
    patterns: [
      /\bhow long (?:do|does) .+ live\b/,
      /\blife ?span\b/,
      /\blifetime\b/,
      /\blife expectancy\b/,
    ],
  },
  {
    relation: "temperature",
    patterns: [
      /\bhow (?:hot|cold|warm)\b/,
      /\btemperature\b/,
      /\bdegrees\b/,
    ],
  },
  {
    relation: "composition",
    patterns: [
      /\bwhat (?:is|are) .+ made (?:of|from)\b/,
      /\bmade (?:of|from)\b/,
      /\bcomposition\b/,
      /\bmaterial\b/,
    ],
  },
  {
    relation: "color",
    patterns: [/\bwhat colou?r\b/, /\bcolou?r of\b/, /\bcolou?r is\b/],
  },
  {
    relation: "size",
    patterns: [
      /\bhow (?:big|large|small|wide|long|tall|heavy)\b/,
      /\bsize\b/,
      /\bdiameter\b/,
      /\bmass\b/,
      /\bweight\b/,
    ],
  },
  {
    relation: "symbol",
    patterns: [/\bwhat symbol\b/, /\bsymbol for\b/, /\bchemical symbol\b/],
  },
  {
    relation: "contains",
    patterns: [
      /\bwhat (?:do|does) .+ contain\b/,
      /\bwhat is inside\b/,
      /\bcontains?\b/,
      /\bcontents?\b/,
    ],
  },
  {
    relation: "produces",
    patterns: [
      /\bwhat (?:do|does) .+ produce\b/,
      /\bwhat .+ makes?\b/,
      /\bproduces?\b/,
      /\byields?\b/,
    ],
  },
  {
    relation: "requires",
    patterns: [
      /\bwhat (?:do|does) .+ need\b/,
      /\bwhat is needed\b/,
      /\brequires?\b/,
      /\brequirements?\b/,
      /\bdepends? on\b/,
    ],
  },
  {
    relation: "has_part",
    patterns: [
      /\bwhat are (?:the )?(?:main )?(?:parts|components|elements) (?:of|in)\b/,
      /\bwhat parts? (?:do|does)\b/,
      /\bwhat (?:parts|components|elements) (?:are|does)\b/,
      /\bparts of\b/,
      /\bcomponents of\b/,
      /\bhas what parts\b/,
    ],
  },
  {
    relation: "part_of",
    patterns: [
      /\bwhat is .+ part of\b/,
      /\bpart of what\b/,
      /\bbelongs to\b/,
      /\binside which\b/,
    ],
  },
  {
    relation: "location",
    patterns: [
      /\bwhere (?:is|are|was|were)\b/,
      /\blocation\b/,
      /\blocated\b/,
      /\bposition\b/,
    ],
  },
  {
    relation: "year",
    patterns: [
      /\bwhat year\b/,
      /\bwhich year\b/,
      /\bwhen (?:was|were|did)\b/,
      /\bdate of\b/,
    ],
  },
  {
    relation: "cause",
    patterns: [
      /\bwhat causes?\b/,
      /\bwhy (?:do|does|did|is|are)\b(?!.*\b(?:important|matter|famous|known)\b)/,
      /\bcause of\b/,
      /\breason for\b/,
      /\bcomes? from\b/,
    ],
  },
  {
    relation: "effect",
    patterns: [
      /\bwhat (?:effect|result|impact)\b/,
      /\bwhat happens because\b/,
      /\bleads? to\b/,
      /\bresults? in\b/,
    ],
  },
  {
    relation: "function",
    patterns: [
      /\bwhat (?:do|does) .+ do\b/,
      /\bfunction of\b/,
      /\brole of\b/,
      /\bjob of\b/,
    ],
  },
  {
    relation: "purpose",
    patterns: [
      /\bwhat is .+ (?:used )?for\b/,
      /\bwhat are .+ used for\b/,
      /\bpurpose of\b/,
      /\bused to do\b/,
      /\bwhy use\b/,
    ],
  },
  {
    relation: "mechanism",
    patterns: [
      /\bhow (?:do|does|did) .+ work\b/,
      /\bhow .+ works?\b/,
      /\bmechanism\b/,
      /\bprocess behind\b/,
      /\bhow is .+ formed\b/,
      /\bhow is .+ made\b/,
    ],
  },
  {
    relation: "importance",
    patterns: [
      /\bwhy (?:is|are) .+ important\b/,
      /\bwhy (?:do|does) .+ matter\b/,
      /\bimportance of\b/,
      /\bsignificance of\b/,
    ],
  },
  {
    relation: "example",
    patterns: [
      /\bexample of\b/,
      /\bgive .+ example\b/,
      /\bshow .+ example\b/,
      /\billustrate\b/,
    ],
  },
  {
    relation: "related_to",
    patterns: [
      /\brelated to\b/,
      /\bconnected to\b/,
      /\bassociated with\b/,
      /\bsimilar concepts?\b/,
    ],
  },
  {
    relation: "is_a",
    patterns: [
      /\bwhat (?:kind|type|category) of\b/,
      /\bclassified as\b/,
      /\bclassification of\b/,
      /^is .+ (?:a|an) .+$/,
      /^are .+ .+$/,
    ],
  },
  {
    relation: "definition",
    patterns: [
      /^(?:what|who) (?:is|are|was|were)\b/,
      /^what exactly (?:is|are)\b/,
      /^(?:define|describe|explain|introduce)\b/,
      /^(?:can|could|would|will) you (?:define|describe|explain|introduce)\b/,
      /^tell me about\b/,
      /\bdefinition of\b/,
      /\bwhat does .+ mean\b/,
    ],
  },
] as const;

function extractGenericRelation(core: string): SemanticRelation | undefined {
  const match = core.match(
    /(?:the|its|their|a)\s+([a-z ]+?)(?:\s+of|\s+for|\s+recorded|\?|$)/,
  );
  return match?.[1] ? relationFromLabel(match[1]) : undefined;
}

function relationInComparison(core: string): SemanticRelation | undefined {
  const match = core.match(
    /\b(?:by|in terms of|with respect to|based on|using|for their)\s+([a-z ]+)$/,
  );
  if (match?.[1]) {
    const relation = relationFromLabel(match[1]);
    if (relation) return relation;
  }

  for (const detector of relationDetectors) {
    if (detector.relation === "definition" || detector.relation === "is_a") continue;
    if (detector.patterns.some((pattern) => pattern.test(core))) return detector.relation;
  }
  return undefined;
}

function objectAfterSubject(core: string, mention: SemanticEntityMention): string | undefined {
  const tail = core.slice(mention.end).trim();
  return tail
    .replace(
      /^(?:have|has|contain|contains|produce|produces|make|makes|eat|eats|need|needs|use|uses|be|is|are|a|an|the)\s+/,
      "",
    )
    .replace(/\b(?:by|in terms of|with respect to|based on|using|for their)\b.+$/, "")
    .trim() || undefined;
}

function detectAbility(
  core: string,
  mention: SemanticEntityMention | undefined,
): RelationDetection | undefined {
  if (!mention) return undefined;
  const before = core.slice(0, mention.start).trim();
  if (
    !/^(?:(?:can|could)(?:\s+(?:a|an|the))?|(?:is|are)(?:\s+(?:a|an|the))?)$/.test(
      before,
    )
  ) {
    return undefined;
  }

  const tail = core.slice(mention.end).trim();
  const mainTail = tail
    .replace(
      /\s+(?:if|provided that|assuming|under the condition that)\s+.+$/,
      "",
    )
    .trim();
  if (/^(?:a|an|the)\s+/.test(tail) && /^(?:is|are)\b/.test(before)) {
    return undefined;
  }
  const propertyPredicate = mainTail.match(
    /^(produce|make|contain|eat|need|require)\s+(.+)$/,
  );
  if (propertyPredicate) {
    const relation: SemanticRelation =
      propertyPredicate[1] === "produce" || propertyPredicate[1] === "make"
        ? "produces"
        : propertyPredicate[1] === "contain"
          ? "contains"
          : propertyPredicate[1] === "eat"
            ? "diet"
            : "requires";
    return {
      relation,
      kind: "boolean",
      ability: mainTail,
      objectText: propertyPredicate[2],
      evidence: ["modal property confirmation frame"],
    };
  }

  const ability = mainTail
    .replace(/^(?:able to|capable of|know how to)\s+/, "")
    .replace(/\s+(?:or not|at all)$/, "")
    .trim();
  if (!ability) {
    return undefined;
  }
  return {
    relation: "ability",
    kind: "boolean",
    ability,
    objectText: ability,
    evidence: ["modal capability frame"],
  };
}

function contextualMentions(
  core: string,
  resolver: SemanticResolver,
  context: SemanticParseContext,
): SemanticEntityMention[] {
  const explicit = resolver.findMentions(core);
  if (!/\b(?:it|its|this|that|they|their|them|those|these)\b/.test(core)) {
    return explicit;
  }

  const contextual = (context.activeSubjectIds ?? [])
    .map((entityId) => resolver.resolveId?.(entityId))
    .filter((mention): mention is SemanticEntityMention => Boolean(mention))
    .map((mention, index) => ({
      ...mention,
      start: core.length + index,
      end: core.length + index + mention.canonicalName.length,
    }));
  return [
    ...explicit,
    ...contextual.filter(
      (candidate) =>
        !explicit.some((mention) => mention.entityId === candidate.entityId),
    ),
  ];
}

function exactDefinitionSubject(
  core: string,
  mentions: SemanticEntityMention[],
): SemanticEntityMention | undefined {
  const tail = core
    .replace(/^(?:(?:what|who) (?:exactly )?(?:is|are|was|were)|(?:define|describe|explain|introduce))\s+/, "")
    .replace(/^(?:a|an|the)\s+/, "")
    .trim();
  if (!tail || tail === core) return undefined;
  return mentions.find((mention) => {
    const mentionName = normalizeText(mention.canonicalName)
      .replace(/^(?:a|an|the)\s+/, "");
    const alias = mention.alias.replace(/^(?:a|an|the)\s+/, "");
    return tail === mentionName || tail === alias;
  });
}

function patternMatchesOutsideMentions(
  pattern: RegExp,
  core: string,
  mentions: SemanticEntityMention[],
): boolean {
  const match = pattern.exec(core);
  pattern.lastIndex = 0;
  if (!match || match.index === undefined) return false;
  const start = match.index;
  const end = start + match[0].length;
  return !mentions.some(
    (mention) => start >= mention.start && end <= mention.end,
  );
}

function detectRelation(
  core: string,
  mentions: SemanticEntityMention[],
): RelationDetection {
  const comparisonRequested = comparisonCue.test(core);
  if (comparisonRequested && mentions.length >= 2) {
    return {
      relation: relationInComparison(core) ?? "comparison",
      kind: "comparison",
      evidence: ["two-subject comparison frame"],
    };
  }
  if (comparisonRequested) {
    return {
      relation: "comparison",
      kind: "unknown",
      evidence: ["comparison requires two graph subjects"],
    };
  }

  const exactDefinition = exactDefinitionSubject(core, mentions);
  if (exactDefinition) {
    return {
      relation: "definition",
      kind: "open",
      evidence: ["exact known-subject definition frame"],
    };
  }

  const first = mentions[0];
  if (
    first &&
    /^how (?:do|does|did)\b/.test(core) &&
    /^(?:how (?:do|does|did))(?:\s+(?:a|an|the))?$/.test(
      core.slice(0, first.start).trim(),
    )
  ) {
    return {
      relation: "mechanism",
      evidence: ["subject-predicate mechanism frame"],
    };
  }

  const ability = detectAbility(core, first);
  if (ability) return ability;

  if (first && /^is\b/.test(core) && mentions.length >= 2) {
    return {
      relation: "is_a",
      kind: "boolean",
      objectText: mentions[1].canonicalName,
      evidence: ["classification confirmation frame"],
    };
  }

  if (first && /^(?:does|do)\b/.test(core)) {
    const objectText = objectAfterSubject(core, first);
    const mappings: Array<[RegExp, SemanticRelation]> = [
      [/\b(?:have|has)\b/, "has_part"],
      [/\bcontains?\b/, "contains"],
      [/\b(?:produce|produces|make|makes)\b/, "produces"],
      [/\b(?:eat|eats)\b/, "diet"],
      [/\b(?:need|needs|require|requires)\b/, "requires"],
    ];
    const mapping = mappings.find(([pattern]) => pattern.test(core));
    if (mapping) {
      return {
        relation: mapping[1],
        kind: "boolean",
        objectText,
        evidence: ["predicate confirmation frame"],
      };
    }
  }

  for (const detector of relationDetectors) {
    if (detector.relation === "definition") continue;
    if (
      !detector.patterns.some((pattern) =>
        patternMatchesOutsideMentions(pattern, core, mentions),
      )
    ) {
      continue;
    }
    const count =
      detector.relation === "leg_count" ||
      /\bhow many\b|\bnumber of\b/.test(core);
    return {
      relation: detector.relation,
      kind: count ? "count" : undefined,
      evidence: [`relation:${detector.relation}`],
    };
  }

  const genericRelation = extractGenericRelation(core);
  if (genericRelation) {
    return {
      relation: genericRelation,
      evidence: ["generic property frame"],
    };
  }

  const unsupportedProperty = core.match(
    /^(?:what|which) (?:is|are) (?:the )?(.+?) of (?:a |an |the )?.+$/,
  )?.[1];
  if (unsupportedProperty && !relationFromLabel(unsupportedProperty)) {
    return {
      relation: "definition",
      kind: "unknown",
      evidence: [`unsupported-property:${unsupportedProperty}`],
    };
  }

  const definitionDetector = relationDetectors.find(
    (detector) => detector.relation === "definition",
  );
  if (
    definitionDetector?.patterns.some((pattern) =>
      patternMatchesOutsideMentions(pattern, core, mentions),
    )
  ) {
    return {
      relation: "definition",
      evidence: ["relation:definition"],
    };
  }

  return {
    relation: "definition",
    kind: "unknown",
    evidence: ["no supported relation frame"],
  };
}

function extractModifiers(
  core: string,
  style: SemanticQuery["modifiers"]["style"],
): SemanticQuery["modifiers"] {
  const condition = core.match(
    /\b(?:if|provided that|assuming|under the condition that)\s+(.+)$/,
  )?.[1];
  const time = core.match(
    /\b(?:today|yesterday|tomorrow|currently|now|in \d{4}|during [a-z ]+)\b/,
  )?.[0];
  const quantityText = core.match(/\b(\d+(?:\.\d+)?)\b/)?.[1];
  return {
    condition,
    time,
    quantity: quantityText ? Number(quantityText) : undefined,
    style,
    negated: /\b(?:not|never|no|cannot|can't|doesn't|isn't|aren't)\b/.test(core),
  };
}

export function parseSemanticQuery(
  input: string,
  resolver: SemanticResolver,
  context: SemanticParseContext = {},
): SemanticQuery {
  const prepared = prepareLinguisticInput(input);
  const core = prepared.core || normalizeText(input);
  const mentions = contextualMentions(core, resolver, context);
  const detection = detectRelation(core, mentions);
  const comparison = detection.kind === "comparison";
  const kind =
    detection.kind ??
    (/^(?:is|are|do|does|did|can|could|has|have)\b/.test(core) &&
    !/^(?:can|could|would|will) you (?:define|describe|explain|introduce|tell)\b/.test(core)
      ? "boolean"
      : "open");
  const subjectCandidates =
    kind === "open" && mentions.length > 1
      ? mentions.filter(
          (mention) => relationFromLabel(mention.alias) !== detection.relation,
        )
      : mentions;
  const subject = subjectCandidates[0] ?? mentions[0];
  const relationSubject =
    detection.relation === "cause" &&
    /^what causes?\b/.test(core) &&
    subjectCandidates.length > 1
      ? subjectCandidates.at(-1)
      : subject;
  const object =
    comparison || (kind === "boolean" && detection.relation === "is_a")
      ? mentions.find((mention) => mention.entityId !== subject?.entityId)
      : undefined;
  const confidence =
    kind === "unknown"
      ? 0.2
      : subject
        ? detection.relation === "definition" && detection.evidence.includes("no supported relation frame")
          ? 0.55
          : 0.96
        : 0.42;

  return {
    original: input,
    normalized: normalizeText(input),
    core,
    kind,
    relation: detection.relation,
    subjectText: relationSubject?.canonicalName,
    subjectId: relationSubject?.entityId,
    objectText:
      detection.objectText ??
      (comparison || kind === "boolean" ? object?.canonicalName : undefined),
    objectId:
      comparison || (kind === "boolean" && detection.relation === "is_a")
        ? object?.entityId
        : undefined,
    ability: detection.ability,
    property: detection.relation,
    mentions,
    modifiers: extractModifiers(core, prepared.style),
    confidence,
    evidence: [
      ...detection.evidence,
      ...prepared.appliedFeatures.map((feature) => `feature:${feature}`),
      ...(relationSubject ? [`subject:${relationSubject.entityId}`] : []),
      ...(object ? [`object:${object.entityId}`] : []),
    ],
  };
}
