export type KnowledgeCategory =
  | "mathematics"
  | "computing"
  | "science"
  | "language"
  | "humanities"
  | "everyday"
  | "world"
  | "lexi";

export type KnowledgeTopic = {
  id: string;
  term: string;
  aliases: string[];
  category: KnowledgeCategory;
  definition: string;
  purpose: string;
  mechanism?: string;
  importance: string;
  example: string;
  components?: string[];
  related: string[];
};

export type PackFocus =
  | "definition"
  | "purpose"
  | "mechanism"
  | "importance"
  | "example"
  | "components"
  | "related"
  | "comparison";

export type PackResponse = {
  text: string;
  intent: string;
  recordIds: string[];
  evidence: string[];
  structureId: string;
  confidence: number;
};

export type ConversationRule = {
  id: string;
  intent: string;
  patterns: RegExp[];
  response: string;
  evidence: string[];
};
