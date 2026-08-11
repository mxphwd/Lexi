import type { LexiReply } from "@/lib/lexi/types";

export type Dv10Operation =
  | "lookup"
  | "count"
  | "list"
  | "compare"
  | "reason"
  | "define-sense"
  | "clarify";

export type Dv10Relation =
  | "definition"
  | "count"
  | "member"
  | "closest_to"
  | "average_distance"
  | "state_transition"
  | "purpose"
  | "borders"
  | "origin"
  | "interesting_fact"
  | "arithmetic_result"
  | "lexical_sense"
  | "proof";

export type Dv10Term = {
  text: string;
  normalized: string;
  role: "subject" | "object" | "context";
  entityId?: string;
  candidateSenseIds?: string[];
};

export type Dv10QueryPlan = {
  id: string;
  original: string;
  normalized: string;
  speechAct: "ask" | "request" | "correct" | "follow-up";
  operation: Dv10Operation;
  relation: Dv10Relation;
  subject?: Dv10Term;
  object?: Dv10Term;
  context?: Dv10Term;
  quantity?: number;
  conditions: string[];
  negated: boolean;
  temporal?: string;
  answerShape: "text" | "entity" | "number" | "list" | "explanation";
  confidence: number;
  evidence: string[];
};

export type Dv10PropositionValue =
  | { kind: "text"; value: string }
  | { kind: "entity"; value: string }
  | { kind: "number"; value: number; unit?: string }
  | { kind: "list"; values: string[] };

export type Dv10Provenance = {
  sourceId: string;
  title: string;
  url: string;
  evidenceLocator: string;
  reviewStatus: "source-reviewed" | "mechanically-derived";
  confidence: number;
  validFrom?: string;
  validTo?: string;
};

export type Dv10Proposition = {
  id: string;
  subject: string;
  subjectAliases: string[];
  predicate: Dv10Relation;
  object: Dv10PropositionValue;
  qualifiers?: {
    condition?: string;
    scope?: string;
    time?: string;
  };
  provenance: Dv10Provenance;
};

export type Dv10Match = {
  plan: Dv10QueryPlan;
  reply: LexiReply;
  propositionIds: string[];
};

export type Dv10DialogueTurn = {
  question: string;
  answer: string;
  subjectTexts: string[];
  relation?: string;
  propositionIds: string[];
  proof: string[];
  goal: "answer" | "compare" | "list" | "reason" | "disambiguate" | "clarify";
  source: LexiReply["trace"]["source"];
};

export type Dv10DialogueSnapshot = {
  turns: Dv10DialogueTurn[];
  activeSubjects: string[];
  activeRelation?: string;
  activeLexicalTerm?: string;
  activeLexicalContext?: string;
  pendingGoal?: Dv10DialogueTurn["goal"];
};
