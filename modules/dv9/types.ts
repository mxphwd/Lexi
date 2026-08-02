import type { DictionaryFetcher } from "@/modules/dictionary";

export type Dv9ReviewStatus =
  | "independently-reviewed"
  | "source-attested"
  | "source-attested-association"
  | "mechanically-derived"
  | "disputed";

export type Dv9Provenance = {
  sourceId: "W" | "M" | "D" | "curated";
  evidence: string;
  confidence: number;
  reviewStatus: Dv9ReviewStatus;
  validFrom?: string;
  validTo?: string;
  disputedBy?: string[];
};

export type Dv9LexicalOperation =
  | "define"
  | "list-senses"
  | "part-of-speech"
  | "example"
  | "related"
  | "provenance";

export type Dv9LexicalPlan = {
  id: string;
  original: string;
  normalized: string;
  operation: Dv9LexicalOperation;
  term: string;
  contextHint?: string;
  requestedSense?: number;
  confidence: number;
  evidence: string[];
};

export type Dv9RuntimeMeaning = readonly [
  senseId: string,
  partOfSpeech: string,
  definition: string,
  example: string | null,
];

export type Dv9RuntimeEntry = {
  e: string;
  w: string;
  i: string | null;
  m: Dv9RuntimeMeaning[];
  r: string[];
};

export type Dv9RuntimeShard = Record<string, Dv9RuntimeEntry>;

export type Dv9LoaderOptions = {
  fetcher?: DictionaryFetcher;
  basePath?: string;
};

export type Dv9DataManifest = {
  schemaVersion: 1;
  build: string;
  generatedAt: string;
  targets: {
    validatedAtomicFacts: number;
    entityMinimum: number;
    entityMaximum: number;
    typedRelationProfiles: number;
    explicitLexicalSensesMinimum: number;
    explicitLexicalSensesMaximum: number;
    queryPlanExamples: number;
    inferenceRules: number;
    dialogueScenarios: number;
    heldOutBlindQuestions: number;
  };
  counts: {
    validatedAtomicFacts: number;
    sourceAttestedFacts: number;
    mechanicallyDerivedFacts: number;
    independentlyReviewedNewFacts: number;
    entities: number;
    lemmas: number;
    explicitLexicalSenses: number;
    typedRelationProfiles: number;
    baseRelationPredicates: number;
    queryPlanExamples: number;
    inferenceRules: number;
    inferenceRuleFamilies: number;
    dialogueScenarios: number;
    heldOutBlindQuestions: number;
    userReportedFailureQuestions: number;
    directFinishedConstructions: number;
  };
};

export type Dv9DialogueSnapshot = {
  activeTerm?: string;
  activeSenseIndex: number;
  previousTerms: string[];
  goal?: "define" | "disambiguate" | "classify" | "find-example" | "relate" | "inspect-source";
};
