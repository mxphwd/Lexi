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
    | "safe-fallback"
    | "combined-response";
  clauseCount?: number;
  clauseIntents?: string[];
  subjectIds?: string[];
  proof?: string[];
};

export type LexiReply = {
  text: string;
  trace: LexiTrace;
};
