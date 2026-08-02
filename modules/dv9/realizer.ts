import type { LexiReply } from "@/lib/lexi/types";
import { analyseSentence } from "@/modules/search";
import { contentTokens } from "@/modules/dv8/normalize";
import type { Dv9LexicalPlan, Dv9RuntimeEntry, Dv9RuntimeMeaning } from "./types";

function sentence(value: string) {
  const clean = value.trim().replace(/[.!?]+$/, "");
  return `${clean}.`;
}

function title(value: string) {
  return value ? value[0].toLocaleUpperCase("en-US") + value.slice(1) : value;
}

function matchingSense(entry: Dv9RuntimeEntry, hint?: string) {
  if (!hint) return { meaning: entry.m[0], index: 0 };
  const hints = contentTokens(hint);
  let best: { meaning?: Dv9RuntimeMeaning; index: number; score: number } = { index: 0, score: 0 };
  entry.m.forEach((meaning, index) => {
    const tokens = contentTokens(`${meaning[1]} ${meaning[2]} ${meaning[3] ?? ""}`);
    const score = hints.reduce((sum, candidate) => sum + (tokens.some((token) =>
      token === candidate || token.slice(0, 5) === candidate.slice(0, 5)
    ) ? 1 : 0), 0);
    if (score > best.score) best = { meaning, index, score };
  });
  return { meaning: best.meaning ?? entry.m[0], index: best.meaning ? best.index : 0 };
}

export function realizeDv9Lexical(input: string, plan: Dv9LexicalPlan, entry: Dv9RuntimeEntry): { reply: LexiReply; senseIndex: number } {
  const selected = matchingSense(entry, plan.contextHint);
  const selectedIndex = plan.requestedSense !== undefined
    ? Math.min(Math.max(0, plan.requestedSense), Math.max(0, entry.m.length - 1))
    : selected.index;
  const meaning = entry.m[selectedIndex] ?? selected.meaning;
  let text: string;
  let evidence: string[] = [];
  if (plan.operation === "define") {
    text = meaning
      ? `${title(entry.w)} means ${sentence(meaning[2]).replace(/\.$/, "")} (${meaning[1]}).`
      : `I have an attributed lexical entry for “${entry.w}”, but it has no Wordset definition.`;
    evidence = meaning ? [`wordset:${entry.i}`, `sense:${meaning[0]}`] : [`lemma:${entry.e}`];
  } else if (plan.operation === "list-senses") {
    if (!entry.m.length) {
      text = `I have no recorded Wordset senses for “${entry.w}”.`;
    } else if (plan.requestedSense !== undefined && meaning) {
      text = `Another recorded sense of ${entry.w} is: ${sentence(meaning[2])} (${meaning[1]}).`;
    } else {
      const listed = entry.m.slice(0, 6).map((item, index) => `${index + 1}. ${item[2].trim().replace(/[.!?]+$/, "")} (${item[1]}).`);
      const remainder = entry.m.length > listed.length ? ` ${entry.m.length - listed.length} more senses are recorded.` : "";
      text = `${entry.w} has ${entry.m.length} recorded ${entry.m.length === 1 ? "sense" : "senses"}: ${listed.join(" ")}${remainder}`;
    }
    evidence = entry.m.slice(0, 6).map((item) => `sense:${item[0]}`);
  } else if (plan.operation === "part-of-speech") {
    const parts = [...new Set(entry.m.map((item) => item[1]).filter(Boolean))];
    text = parts.length
      ? `${title(entry.w)} is recorded as ${parts.join(parts.length > 1 ? ", " : "")}.`
      : `The embedded Wordset entry does not record a part of speech for “${entry.w}”.`;
    evidence = entry.m.map((item) => `sense:${item[0]}`);
  } else if (plan.operation === "example") {
    const example = entry.m.find((item) => item[3]) ?? meaning;
    text = example?.[3]
      ? `Recorded example: “${sentence(example[3])}”`
      : `The embedded Wordset entry does not include a usage example for “${entry.w}”.`;
    evidence = example ? [`sense:${example[0]}`] : [`lemma:${entry.e}`];
  } else if (plan.operation === "related") {
    const related = entry.r.slice(0, 8);
    text = related.length
      ? `Moby associates ${entry.w} with ${related.join(", ")}. These are broad lexical associations, not guaranteed strict synonyms.`
      : `I do not have an attributed Moby association for “${entry.w}”.`;
    evidence = related.map((value) => `moby-association:${entry.w}:${value}`);
  } else {
    text = entry.i
      ? `The recorded senses for “${entry.w}” come from Wordset entry ${entry.i}; its lexical associations come from the vendored Moby thesaurus when present.`
      : `The lexical association for “${entry.w}” comes from the vendored Moby thesaurus; no Wordset definition is attached.`;
    evidence = [entry.i ? `wordset:${entry.i}` : "moby:vendored-source"];
  }

  const analysis = analyseSentence(input);
  return {
    senseIndex: selectedIndex,
    reply: {
      text,
      trace: {
        normalizedInput: analysis.normalized,
        sentenceMode: analysis.mode,
        interpretedIntent: `dv9:${plan.operation}`,
        confidence: meaning || entry.r.length ? plan.confidence : 0.7,
        matchedExampleIds: evidence,
        matchedTerms: plan.evidence,
        selectedStructure: `dv9-data-engine:${plan.operation}`,
        source: "dv9-data-engine",
        proof: [
          `Loaded only the compiled “${entry.w}” lexical shard.`,
          entry.i ? `Selected an explicit Wordset sense from entry ${entry.i}.` : "Used an attributed Moby lexical node.",
          "Kept source-attested associations separate from independently reviewed knowledge.",
        ],
      },
    },
  };
}
