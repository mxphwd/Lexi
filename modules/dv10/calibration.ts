import type { LexiReply } from "@/lib/lexi/types";
import { analyseSentence } from "@/modules/search";
import { dv10Normalize } from "./normalize";

const trustedSources = new Set<LexiReply["trace"]["source"]>([
  "semantic-runtime",
  "dv9-data-engine",
  "session-memory",
  "core-phrase",
  "full-dictionary",
  "safe-fallback",
]);

function requiresUnsupportedSpecificity(normalized: string, intent: string) {
  const plainWhoDefinition = /^who (?:is|was) (?:a |an |the )?[\p{L}\p{N}'-]+(?: [\p{L}\p{N}'-]+){0,3}$/u.test(normalized);
  if (plainWhoDefinition && intent === "definition") return false;
  if (/^(?:who|when|where|which|how many|how much)\b/.test(normalized)) {
    if (/^where\b/.test(normalized)) return !/location|habitat|country|continent|learning|direction/.test(intent);
    if (/^when\b/.test(normalized)) return !/year|date|origin|birth|founded/.test(intent);
    if (/^how many\b/.test(normalized)) return !/count|number|quantity|leg_count|atomic_number|continent|reasoning/.test(intent);
    if (/^how much\b/.test(normalized)) return !/count|number|quantity|price|cost|reasoning/.test(intent);
    return intent === "definition";
  }
  if (/^what (?:is|was|are|were) the .+? (?:of|in|for|from)\b/.test(normalized) && intent === "definition") return true;
  const plainDefinition = /^(?:what(?: exactly)? is|describe|tell me about|give (?:me )?(?:the )?definition of) (?:the )?[\p{L}\p{N}-]+$/u.test(normalized);
  if (!plainDefinition && /\b(?:fastest|slowest|largest|smallest|highest|lowest|oldest|youngest|first|second|third|fourth|fifth|most|least)\b/.test(normalized) && intent === "definition") return true;
  const unsupportedMentalState = /^(?:what|why) (?:is|was|are|were|did) (?!critical thinking$).+?\b(?:thinking|feeling|dreaming|decided?)\b/.test(normalized);
  if (unsupportedMentalState && intent === "definition") return true;
  return false;
}

/**
 * Prevents a legacy similarity route from turning one incidental recognized
 * word into a confident answer to a more specific factual question. The guard
 * never manufactures an answer; it converts only incompatible legacy output
 * into an explicit clarification/abstention.
 */
export function calibrateDv10LegacyReply(input: string, reply: LexiReply): LexiReply {
  if (trustedSources.has(reply.trace.source) || reply.trace.confidence < 0.8) return reply;
  const normalized = dv10Normalize(input);
  const intent = reply.trace.interpretedIntent;
  const unsupported = requiresUnsupportedSpecificity(normalized, intent);
  const incompatibleWhichLookup = /\bwhich\b/.test(normalized)
    && reply.trace.source === "language-engine"
    && !reply.trace.selectedStructure.includes(":select:")
    && !/comparison|compare/.test(intent);
  if (!unsupported && !incompatibleWhichLookup) return reply;

  const analysis = analyseSentence(input);
  return {
    text: "I found a related term, but the requested proposition is more specific than the relation I can prove. Please rephrase it with the exact subject and property, or let me abstain.",
    trace: {
      normalizedInput: analysis.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent: "dv10:calibrated-abstention",
      confidence: 1,
      matchedExampleIds: [],
      matchedTerms: [
        `rejected-source:${reply.trace.source}`,
        `rejected-intent:${intent}`,
        "subject-compatible-proof-required",
      ],
      selectedStructure: "dv10-semantic-runtime:calibrated-abstention",
      source: "safe-fallback",
      subjectIds: reply.trace.subjectIds,
      proof: ["Rejected a legacy answer because its proven relation did not satisfy the requested proposition."],
    },
  };
}
