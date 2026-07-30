import type { ConversationRule, PackResponse } from "./types";

const rules: ConversationRule[] = [
  {
    id: "operating-now",
    intent: "operating-state",
    patterns: [/^what are you doing$/, /^what are you up to$/, /^are you working$/],
    response: "I’m ready and waiting for a message to process. I do not run a private train of thought between requests.",
    evidence: ["current operation", "deterministic boundary"],
  },
  {
    id: "reality",
    intent: "identity",
    patterns: [/^are you real$/, /^do you exist$/, /^are you a real person$/],
    response: "I exist as software, not as a person. My replies come from deterministic language rules and recorded knowledge.",
    evidence: ["software identity", "not a person"],
  },
  {
    id: "thinking-boundary",
    intent: "capability",
    patterns: [/^(?:can|do) you think$/, /^do you have thoughts$/, /^do you have a mind$/],
    response: "I process language mechanically. I can compare recognized structures and knowledge records, but I do not have private thoughts or consciousness.",
    evidence: ["mechanical processing", "consciousness boundary"],
  },
  {
    id: "understanding-boundary",
    intent: "capability",
    patterns: [/^do you understand me$/, /^can you understand this$/, /^do you know what i mean$/],
    response: "I can interpret wording that connects to my grammar rules and embedded knowledge. I will say when that connection is too weak.",
    evidence: ["bounded understanding", "confidence boundary"],
  },
  {
    id: "certainty",
    intent: "certainty-check",
    patterns: [/^are you sure$/, /^is that certain$/, /^how certain are you$/, /^really$/],
    response: "My confidence applies to the match I made, not to unlimited truth. Open “Why this response” to inspect the source and structure.",
    evidence: ["confidence", "trace"],
  },
  {
    id: "meaning-repair",
    intent: "clarification-request",
    patterns: [/^i do not understand$/, /^that does not make sense$/, /^i am confused$/, /^explain that again$/],
    response: "Tell me which word or part is unclear, and I will try a shorter explanation from the knowledge I have.",
    evidence: ["clarification", "specific part"],
  },
  {
    id: "short-answer",
    intent: "format-request",
    patterns: [/^(?:please )?(?:be brief|keep it short)$/, /^give me a short answer$/, /^answer briefly$/],
    response: "Understood. Include the question in the same message, and I will use the shortest matching answer form available.",
    evidence: ["brief format", "same-message boundary"],
  },
  {
    id: "simple-answer",
    intent: "format-request",
    patterns: [/^use simple words$/, /^explain simply$/, /^make it easy to understand$/, /^explain like i am a beginner$/],
    response: "Understood. Ask the subject in the same message, and I will return its direct explanation without unnecessary detail.",
    evidence: ["simple format", "same-message boundary"],
  },
  {
    id: "ask-question",
    intent: "conversation-request",
    patterns: [/^ask me a question$/, /^give me a question$/, /^can you ask me something$/],
    response: "What subject would you like to understand better, and what do you already know about it?",
    evidence: ["reviewed question", "learning prompt"],
  },
  {
    id: "tell-something",
    intent: "conversation-request",
    patterns: [/^tell me something$/, /^say something interesting$/, /^teach me something$/],
    response: "A useful starting point is context: the same word can serve different meanings depending on its surrounding words and purpose.",
    evidence: ["context", "recorded observation"],
  },
  {
    id: "bored",
    intent: "conversation",
    patterns: [/^i am bored$/, /^this is boring$/, /^what can i do when i am bored$/],
    response: "Choose a small activity with a clear finish: read one short article, sketch one object, organize one folder, or learn one new concept.",
    evidence: ["bounded activity", "clear finish"],
  },
  {
    id: "motivation",
    intent: "encouragement",
    patterns: [/^i need motivation$/, /^motivate me$/, /^i cannot get started$/, /^how do i start$/],
    response: "Reduce the task to one action you can finish in five minutes. Starting creates evidence of progress, which makes the next action easier to choose.",
    evidence: ["small action", "progress"],
  },
  {
    id: "mistake",
    intent: "recovery",
    patterns: [/^i made a mistake$/, /^what if i make a mistake$/, /^i got it wrong$/],
    response: "Identify what happened, separate the cause from the result, correct the smallest reversible part, and record what you would change next time.",
    evidence: ["cause", "correction", "learning"],
  },
  {
    id: "decision",
    intent: "decision-support",
    patterns: [/^help me decide$/, /^i cannot decide$/, /^how should i choose$/],
    response: "State the options, the outcome you value most, and any hard limits. Then compare each option against the same criteria.",
    evidence: ["options", "criteria", "constraints"],
  },
  {
    id: "privacy",
    intent: "privacy-boundary",
    patterns: [/^do you remember me$/, /^will you remember this$/, /^do you store my messages$/, /^what do you know about me$/],
    response: "I do not use personal memory inside this prototype. I can only use information present in the message currently being processed.",
    evidence: ["no personal memory", "current message"],
  },
  {
    id: "opinion",
    intent: "opinion-boundary",
    patterns: [/^what is your opinion$/, /^what do you believe$/, /^do you have opinions$/, /^what do you think$/],
    response: "I do not hold beliefs or personal opinions. I can compare stated criteria or summarize a supported concept.",
    evidence: ["no beliefs", "criteria comparison"],
  },
  {
    id: "language-support",
    intent: "language-boundary",
    patterns: [/^what languages do you speak$/, /^can you speak other languages$/, /^do you understand english$/],
    response: "This build is designed for English input. Other writing systems remain intentionally blocked until their linguistic rules are implemented.",
    evidence: ["English", "writing-system boundary"],
  },
  {
    id: "live-data",
    intent: "live-data-boundary",
    patterns: [/^do you have internet$/, /^can you browse the internet$/, /^do you know live information$/, /^are you online$/],
    response: "I do not retrieve live information. I answer from code, embedded knowledge, the local dictionary, and recorded contexts.",
    evidence: ["offline knowledge", "no live retrieval"],
  },
  {
    id: "joke-boundary",
    intent: "humor",
    patterns: [/^tell me a joke$/, /^make me laugh$/, /^do you know a joke$/],
    response: "Why did the sentence visit the mechanic? Its clauses were no longer connecting.",
    evidence: ["reviewed joke", "language"],
  },
  {
    id: "compliment-user",
    intent: "social",
    patterns: [/^say something nice$/, /^compliment me$/, /^do you like me$/],
    response: "You are taking the time to ask and refine questions, which is a useful habit for learning.",
    evidence: ["observable behavior", "learning"],
  },
];

export function matchExtendedConversation(normalized: string): PackResponse | undefined {
  const rule = rules.find((candidate) =>
    candidate.patterns.some((pattern) => pattern.test(normalized)),
  );
  if (!rule) return undefined;

  return {
    text: rule.response,
    intent: rule.intent,
    recordIds: [`conversation:${rule.id}`],
    evidence: rule.evidence,
    structureId: `extended-conversation:${rule.id}`,
    confidence: 1,
  };
}

export const extendedConversationPatternCount = rules.reduce(
  (sum, rule) => sum + rule.patterns.length,
  0,
);
