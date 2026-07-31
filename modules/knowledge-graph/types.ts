import type { SemanticRelation } from "@/modules/semantic/types";

export type EntityKind =
  | "concept"
  | "organism"
  | "object"
  | "material"
  | "place"
  | "country"
  | "region"
  | "celestial-body"
  | "person"
  | "organization"
  | "process"
  | "system"
  | "field"
  | "unit"
  | "language"
  | "food";

export type KnowledgeEntity = {
  id: string;
  name: string;
  aliases: string[];
  kind: EntityKind;
};

export type PropositionValue =
  | { kind: "entity"; entityId: string }
  | { kind: "text"; value: string }
  | { kind: "number"; value: number; unit?: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "list"; values: string[] };

export type PropositionQualifier = {
  condition?: string;
  time?: string;
  scope?: string;
};

export type KnowledgeProposition = {
  id: string;
  subjectId: string;
  predicate: SemanticRelation;
  object: PropositionValue;
  qualifiers?: PropositionQualifier;
  source: "curated-dv7" | "extended-pack" | "derived";
};

export type EntitySeedFact =
  | string
  | number
  | boolean
  | readonly string[]
  | {
      value: string | number | boolean | readonly string[];
      unit?: string;
      entity?: boolean;
      condition?: string;
      time?: string;
      scope?: string;
    };

export type KnowledgeEntitySeed = {
  id: string;
  name: string;
  aliases?: readonly string[];
  kind: EntityKind;
  facts: Partial<Record<SemanticRelation, EntitySeedFact | readonly EntitySeedFact[]>>;
};

export type ProofStep = {
  rule:
    | "direct"
    | "inverse"
    | "inheritance"
    | "transitive"
    | "classification"
    | "comparison"
    | "memory"
    | "closed-world-exception";
  propositionIds: string[];
  explanation: string;
};

export type GraphAnswer = {
  propositions: KnowledgeProposition[];
  proof: ProofStep[];
  confidence: number;
  verdict?: boolean;
  comparedSubjectIds?: [string, string];
  relation?: SemanticRelation;
};
