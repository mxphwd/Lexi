import type { SentenceMode } from "@/lib/lexi/types";
import type {
  KnowledgeProposition,
  PropositionQualifier,
} from "@/modules/knowledge-graph";
import type { SemanticRelation } from "@/modules/semantic";

export type QueryOperation =
  | "lookup"
  | "ask"
  | "select"
  | "aggregate"
  | "compare"
  | "transform"
  | "clarify";

export type QueryTerm =
  | { kind: "entity"; entityId: string }
  | { kind: "variable"; name: string }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number; unit?: string }
  | { kind: "boolean"; value: boolean };

export type TriplePattern = {
  subject: QueryTerm;
  predicate: SemanticRelation;
  object: QueryTerm;
  inverse?: boolean;
  optional?: boolean;
};

export type QueryFilter =
  | { kind: "class"; variable: string; classId: string }
  | { kind: "compare"; variable: string; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; value: QueryTerm }
  | { kind: "contains"; variable: string; value: string }
  | { kind: "time"; value: string }
  | { kind: "condition"; value: string; negated: boolean };

export type QueryComparator = "greater" | "less" | "equal" | "different";

export type QueryPlan = {
  id: string;
  original: string;
  normalized: string;
  mode: SentenceMode;
  operation: QueryOperation;
  answerVariable?: string;
  patterns: TriplePattern[];
  filters: QueryFilter[];
  aggregate?: { function: "count" | "min" | "max"; variable: string };
  comparator?: QueryComparator;
  order?: "ascending" | "descending";
  limit?: number;
  negated: boolean;
  quantifier?: "any" | "all" | "none" | "exact";
  temporal?: string;
  condition?: string;
  style?: "plain" | "brief" | "simple" | "detailed" | "technical" | "stepwise" | "practical" | "exampled";
  subjectIds: string[];
  unresolvedTerms: string[];
  confidence: number;
  evidence: string[];
  transform?: {
    task: "convert" | "sort" | "grammar" | "translate" | "summarize" | "rewrite" | "sentence";
    payload: string;
  };
};

export type LiteralValue =
  | { kind: "entity"; entityId: string }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number; unit?: string }
  | { kind: "boolean"; value: boolean };

export type NormalizedFact = {
  id: string;
  propositionId: string;
  subjectId: string;
  predicate: SemanticRelation;
  object: LiteralValue;
  qualifiers?: PropositionQualifier;
  source: KnowledgeProposition["source"];
};

export type QueryBinding = Record<string, LiteralValue>;

export type ExecutionProof = {
  rule:
    | "direct-index"
    | "inverse-index"
    | "join"
    | "inheritance"
    | "transitive"
    | "filter"
    | "aggregate"
    | "comparison"
    | "explicit-negative"
    | "calibrated-unknown";
  factIds: string[];
  explanation: string;
};

export type ExecutionResult = {
  status: "answered" | "unknown" | "ambiguous" | "unsupported";
  operation: QueryOperation;
  bindings: QueryBinding[];
  facts: NormalizedFact[];
  proof: ExecutionProof[];
  verdict?: boolean;
  comparison?: {
    left: LiteralValue;
    right: LiteralValue;
    winner?: "left" | "right";
    equal: boolean;
  };
  aggregateValue?: number;
  confidence: number;
  reason?: string;
};

export type Dv8TurnProposition = {
  subjectIds: string[];
  relation?: SemanticRelation;
  propositionIds: string[];
  question: string;
  answer: string;
  proof: string[];
  goal: "inform" | "verify" | "compare" | "find" | "transform" | "repair";
};
