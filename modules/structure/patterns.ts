export type StructurePattern = {
  id: string;
  intent: string;
  template: string;
};

export const structures: StructurePattern[] = [
  { id: "warm-direct", intent: "greeting", template: "{response}" },
  { id: "identity-direct", intent: "identity", template: "{response}" },
  { id: "origin-direct", intent: "origin", template: "{response}" },
  { id: "mechanism-sequence", intent: "mechanism", template: "{response}" },
  { id: "contrast-direct", intent: "compare-ai", template: "{response}" },
  { id: "module-explanation", intent: "context-module", template: "{response}" },
  { id: "module-explanation", intent: "search-module", template: "{response}" },
  { id: "module-explanation", intent: "connect-module", template: "{response}" },
  { id: "module-explanation", intent: "structure-module", template: "{response}" },
  { id: "capability-bounded", intent: "capabilities", template: "{response}" },
  { id: "limitation-cautious", intent: "limitations", template: "{response}" },
  { id: "gratitude-brief", intent: "gratitude", template: "{response}" },
  { id: "farewell-brief", intent: "farewell", template: "{response}" },
  { id: "wellbeing-mechanical", intent: "wellbeing", template: "{response}" },
  { id: "help-menu", intent: "help", template: "{response}" },
  {
    id: "synonym-list",
    intent: "synonym",
    template: "In the current lexicon, {subject} {action} {object}{qualifier}.",
  },
  {
    id: "definition-direct",
    intent: "definition",
    template: "{subject} {action} {object}{qualifier}.",
  },
  {
    id: "unknown-safe",
    intent: "unknown",
    template:
      "I cannot connect that wording to a sufficiently close recorded context yet. Try asking about Lexi, Alphaine, the modules, sentence structure, or a synonym.",
  },
];
