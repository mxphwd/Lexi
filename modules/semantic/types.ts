export type SemanticQuestionKind =
  | "open"
  | "boolean"
  | "count"
  | "comparison"
  | "statement"
  | "memory"
  | "unknown";

export type SemanticRelation =
  | "definition"
  | "is_a"
  | "purpose"
  | "mechanism"
  | "importance"
  | "example"
  | "component"
  | "related_to"
  | "location"
  | "habitat"
  | "capital"
  | "continent"
  | "country"
  | "language"
  | "currency"
  | "color"
  | "composition"
  | "diet"
  | "leg_count"
  | "lifespan"
  | "size"
  | "temperature"
  | "symbol"
  | "atomic_number"
  | "invented_by"
  | "discovered_by"
  | "created_by"
  | "written_by"
  | "known_for"
  | "founded_by"
  | "founded_year"
  | "birth_year"
  | "nationality"
  | "formula"
  | "unit"
  | "year"
  | "cause"
  | "effect"
  | "function"
  | "ability"
  | "has_part"
  | "part_of"
  | "contains"
  | "produces"
  | "requires"
  | "used_by"
  | "classification"
  | "comparison"
  | "user_name"
  | "user_age"
  | "user_location"
  | "user_preference"
  | "previous_subject"
  | "previous_question"
  | "previous_answer";

export type SemanticEntityMention = {
  entityId: string;
  canonicalName: string;
  alias: string;
  start: number;
  end: number;
};

export type SemanticModifiers = {
  condition?: string;
  quantity?: number;
  time?: string;
  style?:
    | "plain"
    | "brief"
    | "simple"
    | "detailed"
    | "technical"
    | "stepwise"
    | "balanced"
    | "practical"
    | "exampled"
    | "analogy";
  negated: boolean;
};

export type SemanticQuery = {
  original: string;
  normalized: string;
  core: string;
  kind: SemanticQuestionKind;
  relation: SemanticRelation;
  subjectText?: string;
  subjectId?: string;
  objectText?: string;
  objectId?: string;
  ability?: string;
  property?: string;
  mentions: SemanticEntityMention[];
  modifiers: SemanticModifiers;
  confidence: number;
  evidence: string[];
};

export type SemanticFrameDefinition = {
  id: string;
  relation: SemanticRelation;
  kind: Exclude<SemanticQuestionKind, "statement" | "memory" | "unknown">;
  pattern: RegExp;
};

export type SemanticResolver = {
  resolveExact(value: string): SemanticEntityMention | undefined;
  resolveId?(entityId: string): SemanticEntityMention | undefined;
  findMentions(value: string): SemanticEntityMention[];
};

export type SemanticParseContext = {
  activeSubjectIds?: readonly string[];
};
