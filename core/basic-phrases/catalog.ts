import type { BasicPhraseDefinition } from "./types";

export const BASIC_PHRASES: readonly BasicPhraseDefinition[] = [
  {
    id: "user-name",
    intent: "user-name",
    patterns: [
      /^(?:what is|do you know) my name$/,
      /^who am i$/,
    ],
    response:
      "I don’t know your name from this message. Lexi does not retain personal identity between messages.",
    evidence: ["my name", "personal-memory-boundary"],
    mode: "interrogative",
  },
  {
    id: "model-age",
    intent: "model-age",
    patterns: [
      /^how old are you$/,
      /^what is your age$/,
      /^when were you (?:born|made|created)$/,
    ],
    response:
      "I don’t have a human age. I am Alphaine™ Lexi Language 1.0 Pre-build 260720-1A.",
    evidence: ["model age", "build identity"],
    mode: "interrogative",
  },
  {
    id: "model-identity",
    intent: "identity",
    patterns: [
      /^what is your name$/,
      /^who are you$/,
      /^what are you$/,
      /^are you lexi$/,
    ],
    response:
      "I’m Lexi, Alphaine’s deterministic, rule-based mechanical language model.",
    evidence: ["Lexi", "Alphaine", "model identity"],
    mode: "interrogative",
  },
  {
    id: "model-creator",
    intent: "creator",
    patterns: [
      /^who (?:made|created|built) you$/,
      /^who is your creator$/,
    ],
    response: "Lexi is created by Alphaine as a mechanical language-model project.",
    evidence: ["creator", "Alphaine"],
    mode: "interrogative",
  },
  {
    id: "wellbeing",
    intent: "wellbeing",
    patterns: [
      /^how are you(?: doing)?$/,
      /^how is it going$/,
      /^are you (?:okay|ok|well)$/,
    ],
    response: "I’m operating normally. I do not experience feelings, but I’m ready to help.",
    evidence: ["wellbeing", "operating state"],
    mode: "interrogative",
  },
  {
    id: "greeting",
    intent: "greeting",
    patterns: [
      /^(?:hello|hi|hey|greetings|howdy)(?: lexi| there)?$/,
      /^good (?:morning|afternoon|evening)(?: lexi)?$/,
    ],
    response: "Hello. I’m Lexi. What would you like to talk about?",
    evidence: ["greeting"],
    mode: "declarative",
  },
  {
    id: "basic-help",
    intent: "capability",
    patterns: [
      /^(?:can|could|will|would) you help me$/,
      /^can you help$/,
      /^help me$/,
      /^what can you do$/,
    ],
    response:
      "I can match English wording to known contexts, connect related terms, and form a rule-based reply. Ask a specific question and I will state what I can support.",
    evidence: ["help", "capability"],
    mode: "interrogative",
  },
  {
    id: "thanks",
    intent: "thanks",
    patterns: [
      /^(?:thanks|thank you|many thanks|much appreciated)(?: lexi)?$/,
    ],
    response: "You’re welcome.",
    evidence: ["thanks"],
    mode: "declarative",
  },
  {
    id: "apology",
    intent: "apology",
    patterns: [
      /^(?:sorry|i am sorry|my apologies)(?: lexi)?$/,
    ],
    response: "Acknowledged. We can continue.",
    evidence: ["apology"],
    mode: "declarative",
  },
  {
    id: "acknowledgement",
    intent: "acknowledgement",
    patterns: [
      /^(?:ok|okay|all right|alright|got it|understood)$/,
    ],
    response: "Understood.",
    evidence: ["acknowledgement"],
    mode: "declarative",
  },
  {
    id: "farewell",
    intent: "farewell",
    patterns: [
      /^(?:bye|goodbye|farewell|see you|see you later|talk to you later)(?: lexi)?$/,
      /^good night(?: lexi)?$/,
    ],
    response: "Goodbye. I’ll be here when you want to continue.",
    evidence: ["farewell"],
    mode: "declarative",
  },
] as const;
