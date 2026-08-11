import type { DictionaryLookupOptions } from "@/modules/dictionary";
import { findDv9Entry, parseDv9LexicalPlan } from "@/modules/dv9";
import { realizeDv9Lexical } from "@/modules/dv9/realizer";
import type { Dv9LexicalPlan } from "@/modules/dv9/types";
import { analyseSentence } from "@/modules/search";
import { dv10ContentTokens, dv10Normalize } from "./normalize";
import type { Dv10DialogueState } from "./dialogue";
import type { Dv10Match, Dv10QueryPlan } from "./types";

const neighborhoods: Readonly<Record<string, readonly string[]>> = {
  river: ["water", "shore", "slope", "land", "canoe", "stream", "riverbank"],
  finance: ["financial", "money", "deposit", "lending", "account", "banking", "business"],
  aviation: ["flight", "aircraft", "pilot", "maneuver", "turn", "lateral"],
  road: ["road", "track", "turn", "slope", "curve"],
  computing: ["computer", "software", "hardware", "data", "processor", "network"],
  biology: ["organism", "cell", "living", "species", "body"],
  music: ["sound", "song", "instrument", "musical", "rhythm"],
};

function expandedHint(hint: string) {
  const tokens = new Set(dv10ContentTokens(hint));
  for (const token of [...tokens]) for (const neighbor of neighborhoods[token] ?? []) tokens.add(neighbor);
  return [...tokens];
}

function senseScore(hint: string, definition: string, example: string | null) {
  const hints = expandedHint(hint);
  const candidate = new Set(dv10ContentTokens(`${definition} ${example ?? ""}`));
  return hints.reduce((score, token) => score + (candidate.has(token) ? 4 : [...candidate].some((value) => value.startsWith(token) || token.startsWith(value)) ? 1 : 0), 0);
}

function compositionalLexicalPlan(input: string): Dv9LexicalPlan | undefined {
  const normalized = dv10Normalize(input);
  const patterns: readonly RegExp[] = [
    /^define (.+?) in (?:the )?context of (.+)$/,
    /^what is the meaning of (.+?) in (.+)$/,
    /^in (.+?) what does (?:the )?word (.+?) mean$/,
    /^explain (.+?) as used in (.+)$/,
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = normalized.match(patterns[index]);
    if (!match) continue;
    const reversed = index === 2;
    const term = (reversed ? match[2] : match[1]).trim();
    const contextHint = (reversed ? match[1] : match[2]).trim();
    if (!term || !contextHint || term.split(" ").length > 12) return undefined;
    return {
      id: `dv10:compositional-sense:${index}:${term}`,
      original: input,
      normalized,
      operation: "define",
      term,
      contextHint,
      confidence: 0.98,
      evidence: [`dv10-language-frame:${index}`, `term:${term}`, `context:${contextHint}`],
    };
  }
  return undefined;
}

export async function matchDv10LexicalSense(
  input: string,
  options: DictionaryLookupOptions,
  dialogue?: Dv10DialogueState,
): Promise<Dv10Match | undefined> {
  const expanded = dialogue?.expandFollowUp(input) ?? input;
  const lexical = compositionalLexicalPlan(expanded) ?? parseDv9LexicalPlan(expanded);
  if (!lexical?.contextHint) return undefined;
  const entry = await findDv9Entry(lexical.term, options);
  if (!entry?.m.length) return undefined;
  const ranked = entry.m
    .map((meaning, index) => ({ meaning, index, score: senseScore(lexical.contextHint!, meaning[2], meaning[3]) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const best = ranked[0];
  const second = ranked[1];
  const analysis = analyseSentence(input);
  const plan: Dv10QueryPlan = {
    id: `dv10:define-sense:${entry.e}:${best?.meaning[0]}`,
    original: input,
    normalized: dv10Normalize(input),
    speechAct: expanded === input ? "ask" : "correct",
    operation: best?.score ? "define-sense" : "clarify",
    relation: "lexical_sense",
    subject: { text: entry.w, normalized: dv10Normalize(entry.w), role: "subject", entityId: entry.e, candidateSenseIds: ranked.map((item) => item.meaning[0]) },
    context: { text: lexical.contextHint, normalized: dv10Normalize(lexical.contextHint), role: "context" },
    conditions: [],
    negated: false,
    answerShape: "text",
    confidence: best?.score && (!second || best.score > second.score) ? 0.98 : 0.72,
    evidence: [`term:${entry.w}`, `context:${lexical.contextHint}`, `sense-score:${best?.score ?? 0}`],
  };
  if (!best?.score || (second && best.score === second.score)) {
    const choices = ranked.slice(0, 3).map((item) => item.meaning[2].replace(/[.!?]+$/, ""));
    return {
      plan,
      propositionIds: ranked.slice(0, 3).map((item) => item.meaning[0]),
      reply: {
        text: `“${entry.w}” has several recorded senses that remain compatible with “${lexical.contextHint}”: ${choices.join("; ")}. Which one do you mean?`,
        trace: {
          normalizedInput: analysis.normalized,
          sentenceMode: analysis.mode,
          interpretedIntent: "dv10:sense-clarification",
          confidence: 1,
          matchedExampleIds: ranked.slice(0, 3).map((item) => `sense:${item.meaning[0]}`),
          matchedTerms: plan.evidence,
          selectedStructure: "dv10-semantic-runtime:clarify:lexical-sense",
          source: "semantic-runtime",
          subjectIds: [entry.e],
          proof: ["Preserved competing explicit senses because the contextual scores were tied."],
        },
      },
    };
  }
  const realized = realizeDv9Lexical(input, { ...lexical, requestedSense: best.index, confidence: plan.confidence }, entry);
  dialogue?.setLexical(entry.w, lexical.contextHint);
  return {
    plan,
    propositionIds: [best.meaning[0]],
    reply: {
      ...realized.reply,
      trace: {
        ...realized.reply.trace,
        interpretedIntent: "dv10:lexical-sense",
        confidence: plan.confidence,
        matchedTerms: plan.evidence,
        selectedStructure: "dv10-semantic-runtime:define-sense",
        source: "semantic-runtime",
        subjectIds: [entry.e],
        proof: [
          `Expanded the context “${lexical.contextHint}” into a declared semantic neighborhood.`,
          `Selected explicit sense ${best.meaning[0]} with score ${best.score}; the next score was ${second?.score ?? 0}.`,
          "Realized only the selected source-attested Wordset sense.",
        ],
      },
    },
  };
}
