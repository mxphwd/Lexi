export type SentenceMode =
  | "declarative"
  | "interrogative"
  | "imperative"
  | "exclamative";

export type ContextEntry = {
  id: string;
  intent: string;
  input: string;
  response: string;
  keywords: string[];
  mode: SentenceMode;
  context: {
    domain: string;
    purpose: string;
    tone: "neutral" | "warm" | "precise" | "cautious";
  };
  slots?: Record<string, string>;
};

export type ContextPage = {
  schemaVersion: 1;
  page: {
    id: string;
    title: string;
    description: string;
    language: "en";
  };
  entries: ContextEntry[];
};

export type SentenceAnalysis = {
  original: string;
  normalized: string;
  tokens: string[];
  contentTokens: string[];
  mode: SentenceMode;
  questionWord?: string;
  auxiliary?: string;
  negated: boolean;
  subject?: string;
  predicate?: string;
  object?: string;
};

export type SearchMatch = {
  entry: ContextEntry;
  score: number;
  lexicalScore: number;
  phraseScore: number;
  structureScore: number;
  matchedTerms: string[];
  expandedTerms: string[];
};

export type ContextDecision = {
  intent: string;
  confidence: number;
  evidence: string[];
  topMatches: SearchMatch[];
};

export type LexiTrace = {
  normalizedInput: string;
  sentenceMode: SentenceMode;
  interpretedIntent: string;
  confidence: number;
  matchedExampleIds: string[];
  matchedTerms: string[];
  selectedStructure: string;
  source:
    | "core-phrase"
    | "exact-example"
    | "context-pattern"
    | "extended-pack"
    | "knowledge-graph"
    | "session-memory"
    | "full-dictionary"
    | "language-engine"
    | "dv9-data-engine"
    | "semantic-runtime"
    | "safe-fallback"
    | "combined-response";
  clauseCount?: number;
  clauseIntents?: string[];
  subjectIds?: string[];
  proof?: string[];
  runtimeVersion?: "DV11";
  executionStatus?:
    | "supported"
    | "contradicted"
    | "unknown"
    | "insufficient"
    | "ambiguous"
    | "partial"
    | "canceled"
    | "error";
  failureStage?: string;
  failureCode?: string;
  propositionIds?: string[];
  sources?: Array<{
    sourceId: string;
    sourceLocation: string;
    reviewStatus: string;
  }>;
  confidenceComponents?: Record<string, number>;
  stages?: Array<{
    stage: string;
    status: "passed" | "partial" | "failed" | "skipped" | "canceled";
    code: string;
    confidence?: number;
    detail: string;
    durationMilliseconds?: number;
  }>;
  clauseResults?: Array<{
    clauseId: string;
    status: string;
    confidence: number;
    propositionIds: string[];
  }>;
};

export type LexiReply = {
  text: string;
  trace: LexiTrace;
};
