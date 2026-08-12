import compiled from "@/data/dv11/compiled-language.json";
import { parseDv9LexicalPlan } from "@/modules/dv9/parser";
import { dv11NormalizeText } from "./normalize";
import type { Dv11LexicalOperation } from "./types";

type CompiledMatch = {
  operation: Dv11LexicalOperation;
  term: string;
  contextHint?: string;
  requestedSense?: number;
  evidence: string[];
};

export type Dv11CompiledLanguageContext = {
  activeLexemeLabel?: string;
  activeSenseIndex?: number;
};

function trimTerm(value: string) {
  return value.replace(/^[\s'“”"]+|[\s?.!'“”"]+$/g, "").trim();
}

export function matchDv11CompiledLanguage(input: string, context: Dv11CompiledLanguageContext = {}): CompiledMatch | undefined {
  const normalized = dv11NormalizeText(input).replace(/[?.!]+$/g, "");
  if (context.activeLexemeLabel) {
    for (const frame of compiled.dialogueFrames) {
      const transition = frame.transitions.find((candidate) => candidate.utterance === normalized);
      if (!transition) continue;
      const operation: Dv11LexicalOperation = transition.action === "next-sense" || transition.action === "repair-sense"
        ? "list-senses"
        : transition.action === "usage-example"
          ? "example"
          : transition.action === "part-of-speech"
            ? "part-of-speech"
            : transition.action === "show-provenance"
              ? "provenance"
              : transition.action === "lexical-association"
                ? "related"
                : "recall-topic";
      return {
        operation,
        term: context.activeLexemeLabel,
        requestedSense: operation === "list-senses" ? (context.activeSenseIndex ?? 0) + 1 : undefined,
        evidence: [`compiled-dialogue:${frame.id}`, `compiled-samples:${frame.samples}`, `compiled-action:${transition.action}`],
      };
    }
  }

  for (const frame of compiled.queryFrames) {
    if (!normalized.startsWith(frame.prefix)) continue;
    if (frame.suffix && !normalized.endsWith(frame.suffix)) continue;
    const end = frame.suffix ? normalized.length - frame.suffix.length : normalized.length;
    const term = trimTerm(normalized.slice(frame.prefix.length, end));
    if (!term || term.split(/\s+/).length > 12) continue;
    return {
      operation: frame.operation as Dv11LexicalOperation,
      term,
      evidence: [`compiled-query:${frame.id}`, `compiled-samples:${frame.samples}`],
    };
  }

  const fallback = parseDv9LexicalPlan(input, context.activeLexemeLabel ? {
    activeTerm: context.activeLexemeLabel,
    activeSenseIndex: context.activeSenseIndex ?? 0,
    previousTerms: [],
  } : undefined);
  return fallback ? {
    operation: fallback.operation,
    term: fallback.term,
    contextHint: fallback.contextHint,
    requestedSense: fallback.requestedSense,
    evidence: ["compiled-lexical-grammar", ...fallback.evidence],
  } : undefined;
}

export function dv11CompiledLanguageStats() {
  return {
    sourceExamples: compiled.sourceExamples,
    sourceDialogueScenarios: compiled.sourceDialogueScenarios,
    compiledQueryFrames: compiled.compiledQueryFrameCount,
    compiledDialogueFrames: compiled.compiledDialogueFrameCount,
    compiledTransitions: compiled.compiledTransitionCount,
  };
}
