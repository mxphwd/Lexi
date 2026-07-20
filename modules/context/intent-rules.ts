import type { SentenceAnalysis } from "@/lib/lexi/types";

type IntentRule = {
  intent: string;
  any: string[];
  all?: string[];
  weight: number;
};

const rules: IntentRule[] = [
  { intent: "greeting", any: ["hello", "hi", "hey", "greetings"], weight: 0.98 },
  { intent: "gratitude", any: ["thanks", "thank", "appreciate"], weight: 0.96 },
  { intent: "farewell", any: ["bye", "goodbye", "farewell"], weight: 0.96 },
  { intent: "wellbeing", any: ["feeling", "doing", "today"], all: ["how"], weight: 0.84 },
  { intent: "identity", any: ["who", "what"], all: ["lexi"], weight: 0.88 },
  { intent: "origin", any: ["alphaine", "origin", "created", "name"], weight: 0.83 },
  { intent: "mechanism", any: ["work", "mechanism", "process", "pipeline"], weight: 0.86 },
  { intent: "compare-ai", any: ["ai", "llm", "chatgpt", "prediction", "token"], weight: 0.89 },
  {
    intent: "context-module",
    any: ["module", "interpret", "understand", "meaning", "confidence"],
    all: ["context"],
    weight: 0.9,
  },
  { intent: "search-module", any: ["search", "retrieve", "lookup", "find"], weight: 0.85 },
  { intent: "connect-module", any: ["connect", "combine", "join", "link"], weight: 0.85 },
  { intent: "structure-module", any: ["structure", "grammar", "sentence", "clause"], weight: 0.85 },
  { intent: "capabilities", any: ["can", "capable", "feature", "ability"], weight: 0.8 },
  { intent: "limitations", any: ["limit", "mistake", "wrong", "hallucinate"], weight: 0.87 },
  { intent: "definition", any: ["define", "definition", "mean", "meaning"], weight: 1.12 },
  { intent: "synonym", any: ["synonym", "synonyms", "similar", "alternative", "thesaurus"], weight: 1.16 },
  { intent: "help", any: ["help", "guide", "start"], weight: 0.76 },
];

export function ruleIntents(analysis: SentenceAnalysis): Map<string, number> {
  const joined = analysis.tokens.join(" ");
  const scores = new Map<string, number>();

  for (const rule of rules) {
    const anyMatch = rule.any.some((term) => joined.includes(term));
    const allMatch = (rule.all ?? []).every((term) => joined.includes(term));
    if (anyMatch && allMatch) scores.set(rule.intent, rule.weight);
  }

  return scores;
}
