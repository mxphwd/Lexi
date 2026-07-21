import { normalizeText } from "@/modules/search/tokenize";

const definitionFrames = [
  /^(?:what (?:is|are)|define|describe) (?:a |an |the )?(.+)$/,
  /^what does (?:the (?:word|term) )?["']?(.+?)["']? mean$/,
  /^(?:give|tell) me (?:a |the )?definition (?:of|for) (.+)$/,
  /^(?:can|could|would|will) you define (?:a |an |the )?(.+)$/,
];

export function extractDefinitionTerm(input: string): string | undefined {
  const normalized = normalizeText(input);

  for (const frame of definitionFrames) {
    const term = normalized.match(frame)?.[1]
      ?.replace(/^(?:word|term)\s+/, "")
      .replace(/^['"]|['"]$/g, "")
      .trim();

    if (term && term.split(/\s+/).length <= 5) return term;
  }

  return undefined;
}
