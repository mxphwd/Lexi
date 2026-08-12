import type { SentenceMode } from "@/lib/lexi/types";
import type { SemanticRelation } from "@/modules/semantic/types";

export type Dv11ExecutionStatus =
  | "supported"
  | "contradicted"
  | "unknown"
  | "insufficient"
  | "ambiguous"
  | "partial"
  | "canceled"
  | "error";

export type Dv11FailureStage =
  | "normalization"
  | "segmentation"
  | "parsing"
  | "entity-linking"
  | "sense-selection"
  | "routing"
  | "retrieval"
  | "reasoning"
  | "calibration"
  | "realization"
  | "state-mutation"
  | "resource-loading";

export type Dv11AnswerShape =
  | "boolean"
  | "entity"
  | "entities"
  | "number"
  | "quantity"
  | "text"
  | "explanation"
  | "procedure"
  | "proof";

export type Dv11SpeechAct =
  | "ask"
  | "request"
  | "assert"
  | "correct"
  | "retract"
  | "follow-up";

export type Dv11Operation =
  | "select"
  | "verify"
  | "aggregate"
  | "compare"
  | "transform"
  | "calculate"
  | "infer"
  | "remember"
  | "recall"
  | "correct"
  | "retract"
  | "clarify"
  | "explain-proof";

export type Dv11Relation = SemanticRelation | (string & {});

export type Dv11EntityKind =
  | "concept"
  | "person"
  | "organization"
  | "place"
  | "country"
  | "region"
  | "organism"
  | "object"
  | "material"
  | "process"
  | "system"
  | "field"
  | "language"
  | "unit"
  | "celestial-body"
  | "unknown";

export type Dv11SourceSpan = {
  start: number;
  end: number;
  text: string;
};

export type Dv11SenseCandidate = {
  senseId: string;
  entityId: string;
  lemma: string;
  partOfSpeech?: string;
  domains: string[];
  definition?: string;
  aliases?: string[];
  usages?: string[];
  contextualFeatures?: string[];
  score: number;
  evidence: string[];
};

export type Dv11EntityCandidate = {
  entityId: string;
  canonicalName: string;
  kind: Dv11EntityKind;
  alias: string;
  score: number;
  senseId?: string;
  evidence: string[];
};

export type Dv11Mention = {
  id: string;
  span: Dv11SourceSpan;
  grammaticalRole:
    | "subject"
    | "direct-object"
    | "indirect-object"
    | "predicate-complement"
    | "modifier"
    | "unknown";
  number: "singular" | "plural" | "unknown";
  candidates: Dv11EntityCandidate[];
  senses: Dv11SenseCandidate[];
  selectedEntityId?: string;
  selectedSenseId?: string;
};

export type Dv11Quantity = {
  value: number;
  unit?: string;
  dimension?: string;
  tolerance?: number;
  uncertainty?: number;
  significantFigures?: number;
};

export type Dv11Value =
  | { kind: "entity"; entityId: string }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number }
  | { kind: "quantity"; quantity: Dv11Quantity }
  | { kind: "boolean"; value: boolean }
  | { kind: "date"; value: string }
  | { kind: "interval"; from?: string; to?: string }
  | { kind: "ordered-list"; values: Dv11Value[] }
  | { kind: "set"; values: Dv11Value[] };

export type Dv11Term =
  | Dv11Value
  | { kind: "variable"; name: string; expectedKind?: Dv11Value["kind"] | "any" };

export type Dv11Pattern = {
  id: string;
  subject: Dv11Term;
  relation: Dv11Relation;
  object: Dv11Term;
  optional: boolean;
  negated: boolean;
};

export type Dv11Filter =
  | { kind: "compare"; left: Dv11Term; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; right: Dv11Term }
  | { kind: "membership"; value: Dv11Term; set: Dv11Term; negated: boolean }
  | { kind: "contains"; value: Dv11Term; needle: string; negated: boolean }
  | { kind: "type"; value: Dv11Term; entityKind?: Dv11EntityKind; classId?: string; negated: boolean }
  | { kind: "condition"; expression: Dv11Condition };

export type Dv11Condition =
  | { kind: "proposition"; pattern: Dv11Pattern }
  | { kind: "and" | "or"; operands: Dv11Condition[] }
  | { kind: "not"; operand: Dv11Condition }
  | { kind: "if"; premise: Dv11Condition; consequence: Dv11Condition }
  | { kind: "counterfactual"; premiseText: string; consequenceText?: string };

export type Dv11Quantifier = {
  kind: "all" | "any" | "none" | "some" | "each" | "most" | "exact" | "minimum" | "maximum";
  variable: string;
  universeClassId?: string;
  cardinality?: number;
};

export type Dv11TemporalConstraint = {
  kind: "point" | "interval" | "before" | "after" | "current" | "historical" | "recurring";
  value?: string;
  from?: string;
  to?: string;
  recurrence?: string;
};

export type Dv11Order = {
  variable: string;
  direction: "ascending" | "descending";
  ordinal?: number;
};

export type Dv11ConfidenceComponents = {
  normalization: number;
  segmentation: number;
  parsing: number;
  entityLinking: number;
  senseSelection: number;
  routing: number;
  evidence: number;
  proof: number;
  conflict: number;
  realization: number;
};

export type Dv11ClausePlan = {
  id: string;
  source: Dv11SourceSpan;
  speechAct: Dv11SpeechAct;
  operation: Dv11Operation;
  mode: SentenceMode;
  requestedProperty?: string;
  answerVariable?: string;
  answerShape: Dv11AnswerShape;
  mentions: Dv11Mention[];
  patterns: Dv11Pattern[];
  filters: Dv11Filter[];
  quantifiers: Dv11Quantifier[];
  temporal: Dv11TemporalConstraint[];
  conditions: Dv11Condition[];
  order: Dv11Order[];
  offset: number;
  limit?: number;
  negated: boolean;
  unresolvedSlots: string[];
  evidence: string[];
  confidence: Dv11ConfidenceComponents;
  pluginId: string;
};

export type Dv11QueryPlan = {
  id: string;
  original: string;
  normalized: string;
  clauses: Dv11ClausePlan[];
  alternatives: Array<{ clauseId: string; plans: Dv11ClausePlan[] }>;
  dialogueReferences: Dv11DialogueReference[];
  createdAt: string;
};

export type Dv11NormalizedRequest = {
  id: string;
  original: string;
  normalized: string;
  tokens: string[];
  clauses: Dv11SourceSpan[];
  mode: SentenceMode;
  language: "en" | "und";
  complexity: {
    characters: number;
    tokens: number;
    clauses: number;
    estimatedOperations: number;
  };
  warnings: string[];
};

export type Dv11Provenance = {
  sourceId: string;
  sourceLocation: string;
  title?: string;
  extractionMethod: "curated" | "imported" | "mechanically-derived" | "session" | "inferred";
  reviewStatus: "independently-reviewed" | "source-attested" | "mechanically-derived" | "disputed";
  confidence: number;
  createdAt: string;
  validFrom?: string;
  validTo?: string;
  license?: string;
  disputeStatus: "undisputed" | "disputed" | "superseded";
  disputedBy?: string[];
};

export type Dv11Proposition = {
  id: string;
  subjectId: string;
  relation: Dv11Relation;
  object: Dv11Value;
  qualifiers: {
    condition?: Dv11Condition;
    temporal?: Dv11TemporalConstraint;
    scope?: string;
    certainty?: number;
  };
  provenance: Dv11Provenance[];
  polarity: "positive" | "negative";
  supersedes?: string[];
};

export type Dv11PredicateSchema = {
  id: Dv11Relation;
  label: string;
  domain: Dv11EntityKind[];
  range: Array<Dv11Value["kind"]>;
  cardinality: "one" | "many" | "ordered-many";
  functional: boolean;
  symmetric: boolean;
  inverse?: Dv11Relation;
  transitive: boolean;
  inheritable: boolean;
  unitDimension?: string;
  temporalBehavior: "timeless" | "point" | "interval" | "versioned";
  worldAssumption: "open" | "closed";
};

export type Dv11Entity = {
  id: string;
  canonicalName: string;
  kind: Dv11EntityKind;
  aliases: string[];
  senseIds: string[];
};

export type Dv11ProofStep = {
  id: string;
  ruleId: string;
  premiseIds: string[];
  conclusion?: string;
  explanation: string;
};

export type Dv11Binding = Record<string, Dv11Value>;

export type Dv11ClauseResult = {
  clauseId: string;
  status: Dv11ExecutionStatus;
  answerShape: Dv11AnswerShape;
  bindings: Dv11Binding[];
  propositions: Dv11Proposition[];
  proof: Dv11ProofStep[];
  aggregate?: Dv11Value;
  verdict?: boolean;
  requestedCount?: number;
  returnedCount?: number;
  missingSlots: string[];
  reason?: string;
  confidence: Dv11ConfidenceComponents;
  calibratedConfidence: number;
  calibrationGroup?: {
    parser: string;
    route: Dv11Operation;
    intent: Dv11SpeechAct;
    relation?: Dv11Relation;
    difficulty: "basic" | "compositional" | "multi-constraint";
  };
  text?: string;
  legacyMetadata?: {
    source: import("@/lib/lexi/types").LexiTrace["source"];
    interpretedIntent: string;
    selectedStructure: string;
    matchedExampleIds: string[];
    matchedTerms: string[];
    subjectIds: string[];
    confidence: number;
    proof: string[];
  };
};

export type Dv11ExecutionResult = {
  status: Dv11ExecutionStatus;
  plan: Dv11QueryPlan;
  clauses: Dv11ClauseResult[];
  proof: Dv11ProofStep[];
  calibratedConfidence: number;
  failureStage?: Dv11FailureStage;
  failureCode?: string;
};

export type Dv11TraceStage = {
  stage: Dv11FailureStage;
  status: "passed" | "partial" | "failed" | "skipped" | "canceled";
  code: string;
  confidence?: number;
  detail: string;
  durationMilliseconds?: number;
};

export type Dv11DialogueReference = {
  text: string;
  resolvedEntityIds: string[];
  antecedentTurnId?: string;
  score: number;
  evidence: string[];
};

export type Dv11DialogueGoal = {
  id: string;
  type: "answer" | "compare" | "list" | "explain" | "correct" | "remember" | "clarify";
  status: "pending" | "satisfied" | "abandoned";
  unresolvedSlots: string[];
  createdTurnId: string;
};

export type Dv11DialogueTurn = {
  id: string;
  userText: string;
  answerText: string;
  plan: Dv11QueryPlan;
  result: Dv11ExecutionResult;
  activeEntityIds: string[];
  createdAt: string;
  canceled: boolean;
};

export type Dv11DialogueSnapshot = {
  turns: Dv11DialogueTurn[];
  topicStack: string[];
  activePropositionIds: string[];
  activeEntityIds: string[];
  comparisonPair: string[];
  pendingQuestion?: string;
  requestedAnswerShape?: Dv11AnswerShape;
  unresolvedSlots: string[];
  goals: Dv11DialogueGoal[];
  memories: Dv11Proposition[];
  corrections: Array<{ turnId: string; supersededPropositionIds: string[]; replacementIds: string[] }>;
};

export type Dv11PackageManifest = {
  schemaVersion: 1;
  packageId: string;
  version: string;
  minimumRuntime: "DV11";
  contentHash: string;
  generatedAt: string;
  dependencies: Array<{ packageId: string; versionRange: string }>;
  counts: { entities: number; propositions: number; senses: number; schemas: number; rules: number };
  capabilities: string[];
};

export type Dv11KnowledgePackage = {
  manifest: Dv11PackageManifest;
  entities: Dv11Entity[];
  propositions: Dv11Proposition[];
  schemas: Dv11PredicateSchema[];
  senses: Dv11SenseCandidate[];
};

export type Dv11EngineOptions = {
  signal?: AbortSignal;
  now?: () => Date;
  maximumCharacters?: number;
  maximumTokens?: number;
  maximumClauses?: number;
  maximumOperations?: number;
};
