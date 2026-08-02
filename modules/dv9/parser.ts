import type { Dv9DialogueSnapshot, Dv9LexicalOperation, Dv9LexicalPlan } from "./types";
import { dv9NormalizeLexical } from "./normalize";

type Frame = {
  operation: Dv9LexicalOperation;
  pattern: RegExp;
  termGroup?: number;
  hintGroup?: number;
};

const frames: readonly Frame[] = [
  { operation: "define", pattern: /^(?:what (?:is|are)|define|describe|explain) (.+)$/, termGroup: 1 },
  { operation: "define", pattern: /^tell me about (.+)$/, termGroup: 1 },
  { operation: "define", pattern: /^what does (?:the (?:word|term) )?(.+?) mean(?: in (.+))?$/, termGroup: 1, hintGroup: 2 },
  { operation: "define", pattern: /^in plain language give me the meaning attached to (.+)$/, termGroup: 1 },
  { operation: "define", pattern: /^how is (.+) defined in the embedded lexicon$/, termGroup: 1 },
  { operation: "define", pattern: /^(?:give|tell) me (?:a |the )?(?:definition|meaning) (?:of|for) (.+)$/, termGroup: 1 },
  { operation: "list-senses", pattern: /^(?:list|show|enumerate) (?:the )?(?:recorded |distinct )?(?:meanings|senses|definitions)(?: stored)? (?:of|for) (.+)$/, termGroup: 1 },
  { operation: "list-senses", pattern: /^what are the (?:recorded )?(?:meanings|senses) of (.+)$/, termGroup: 1 },
  { operation: "list-senses", pattern: /^does (.+) carry more than one recorded sense show them$/, termGroup: 1 },
  { operation: "part-of-speech", pattern: /^what part of speech is (.+)$/, termGroup: 1 },
  { operation: "part-of-speech", pattern: /^under which grammatical category is (.+?) recorded$/, termGroup: 1 },
  { operation: "part-of-speech", pattern: /^classify (.+?)(?: grammatically)?$/, termGroup: 1 },
  { operation: "example", pattern: /^(?:use|show a recorded usage of) (.+?)(?: in an example| in a sentence)?$/, termGroup: 1 },
  { operation: "example", pattern: /^(?:give|show) (?:me )?(?:an |a )?(?:usage )?example (?:of|for|with) (.+)$/, termGroup: 1 },
  { operation: "related", pattern: /^(?:give|name) (?:me )?(?:a |an )?(?:related word|attributed lexical association) (?:for|to) (.+)$/, termGroup: 1 },
  { operation: "related", pattern: /^(?:what|which) (?:vocabulary|words) (?:is|are) (?:connected|associated|related) (?:with|to) (.+?)(?: in the thesaurus source)?$/, termGroup: 1 },
  { operation: "related", pattern: /^(?:what is related to|synonyms? (?:of|for)) (.+)$/, termGroup: 1 },
  { operation: "provenance", pattern: /^(?:where did (?:the meaning of )?|what is the source (?:for|of) )(.+?)(?: come from)?$/, termGroup: 1 },
];

function cleanTerm(value: string) {
  return value
    .replace(/(?: please| according to the dictionary)$/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function followUpPlan(original: string, normalized: string, context?: Dv9DialogueSnapshot): Dv9LexicalPlan | undefined {
  const term = context?.activeTerm;
  if (!term) return undefined;
  let operation: Dv9LexicalOperation | undefined;
  let requestedSense: number | undefined;
  if (/^(?:(?:what is |show me |give me )?(?:another|the other|its other) (?:meaning|sense)|no i meant its other sense)$/.test(normalized)) {
    operation = "list-senses";
    requestedSense = context.activeSenseIndex + 1;
  } else if (/^(?:what part of speech is it|classify it grammatically)$/.test(normalized)) {
    operation = "part-of-speech";
  } else if (/^(?:use it in an example|show an example|give me an example)$/.test(normalized)) {
    operation = "example";
  } else if (/^(?:what is related to it|give me a related word)$/.test(normalized)) {
    operation = "related";
  } else if (/^(?:where did that come from|what is its source|show the source)$/.test(normalized)) {
    operation = "provenance";
  }
  if (!operation) return undefined;
  return {
    id: `dv9:follow-up:${operation}:${term}`,
    original,
    normalized,
    operation,
    term,
    requestedSense,
    confidence: 0.98,
    evidence: ["active lexical proposition", `operation:${operation}`],
  };
}

export function parseDv9LexicalPlan(input: string, context?: Dv9DialogueSnapshot): Dv9LexicalPlan | undefined {
  const normalized = dv9NormalizeLexical(input);
  const followUp = followUpPlan(input, normalized, context);
  if (followUp) return followUp;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const match = normalized.match(frame.pattern);
    if (!match) continue;
    const term = cleanTerm(match[frame.termGroup ?? 1] ?? "");
    if (!term || term.split(/\s+/).length > 12) continue;
    const hint = frame.hintGroup ? cleanTerm(match[frame.hintGroup] ?? "") : undefined;
    return {
      id: `dv9:lexical:${frame.operation}:${index}:${term}`,
      original: input,
      normalized,
      operation: frame.operation,
      term,
      contextHint: hint || undefined,
      confidence: 0.96,
      evidence: [`frame:${index}`, `operation:${frame.operation}`, `term:${term}`],
    };
  }
  return undefined;
}
