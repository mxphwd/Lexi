import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { dv11NormalizeText } from "@/modules/dv11/normalize";

export const dv11OutcomeLabels = [
  "correct-answer",
  "correct-abstention",
  "incorrect-answer",
  "unsupported-abstention",
  "clarification",
  "partial-answer",
  "evaluator-error",
] as const;

export type Dv11EvaluationOutcome = (typeof dv11OutcomeLabels)[number];
export type Dv11BenchmarkCategory =
  | "everyday-fact" | "definition" | "explanation" | "procedure" | "comparison"
  | "arithmetic" | "logic" | "dialogue" | "reference" | "ambiguity" | "multi-part";
export type Dv11FailureClass =
  | "knowledge" | "parsing" | "sense" | "routing" | "reasoning" | "dialogue"
  | "realization" | "calibration" | "evaluator";
export type Dv11ComponentLabels = Partial<Record<
  "intent" | "requestedProperty" | "subject" | "object" | "relation" | "wordSense"
  | "conditions" | "quantifiers" | "negation" | "temporalScope" | "answerShape" | "clauseBoundaries",
  string | number | boolean | readonly string[]
>>;

export type Dv11ExpectedAnswer = {
  canonical?: string;
  aliases?: readonly string[];
  paraphraseConcepts?: readonly (readonly string[])[];
  numeric?: { value: number; tolerance?: number; relativeTolerance?: number; unit?: string };
  unorderedSet?: readonly string[];
  orderedList?: readonly string[];
  abstention?: boolean;
  clarificationSlots?: readonly string[];
};

export type Dv11BenchmarkRow = {
  id: string;
  category: Dv11BenchmarkCategory;
  prompt: string;
  answerable: boolean;
  expected: Dv11ExpectedAnswer;
  conversationState?: unknown;
  expectedComponents?: Dv11ComponentLabels;
  provenance: { sourceId: string; sourceLocation: string; capturedAt: string; consent: "evaluation-only" };
  immutableHash: string;
  failureClass?: Dv11FailureClass;
  observedOutput?: string;
  outcome?: Dv11EvaluationOutcome;
  adjudication?: { required: boolean; reviewer?: string; note?: string };
};

export type Dv11Grade = {
  outcome: Dv11EvaluationOutcome;
  equivalent: boolean;
  reason: string;
  requiresHumanAdjudication: boolean;
  normalizedExpected?: string;
  normalizedActual: string;
};

const unitTable: Record<string, { dimension: string; scale: number }> = {
  m: { dimension: "length", scale: 1 }, meter: { dimension: "length", scale: 1 }, meters: { dimension: "length", scale: 1 },
  km: { dimension: "length", scale: 1_000 }, kilometer: { dimension: "length", scale: 1_000 }, kilometers: { dimension: "length", scale: 1_000 },
  cm: { dimension: "length", scale: 0.01 }, centimeter: { dimension: "length", scale: 0.01 }, centimeters: { dimension: "length", scale: 0.01 },
  kg: { dimension: "mass", scale: 1 }, kilogram: { dimension: "mass", scale: 1 }, kilograms: { dimension: "mass", scale: 1 },
  g: { dimension: "mass", scale: 0.001 }, gram: { dimension: "mass", scale: 0.001 }, grams: { dimension: "mass", scale: 0.001 },
  c: { dimension: "temperature-c", scale: 1 }, "°c": { dimension: "temperature-c", scale: 1 }, celsius: { dimension: "temperature-c", scale: 1 },
};

function normalizedAnswer(value: string) {
  return dv11NormalizeText(value)
    .replace(/\b(?:a|an|the)\b/g, " ")
    .replace(/[^\p{L}\p{N}.%+\-°]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalizedAnswer(value).split(" ").filter(Boolean));
}

function parseNumeric(value: string) {
  return [...dv11NormalizeText(value).matchAll(/([+-]?\d+(?:,\d{3})*(?:\.\d+)?)\s*([a-z°]+)?/gi)].flatMap((match) => {
    const number = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(number)) return [];
    const unit = match[2]?.toLocaleLowerCase("en-US");
    const unitInfo = unit ? unitTable[unit] : undefined;
    return [{ value: unitInfo ? number * unitInfo.scale : number, dimension: unitInfo?.dimension, unit }];
  });
}

function listItems(value: string) {
  return dv11NormalizeText(value)
    .replace(/^(?:first|answer|items?)\s*:\s*/, "")
    .split(/\s*(?:,|;|\band\b|\bthen\b)\s*/)
    .map(normalizedAnswer)
    .filter(Boolean);
}

function containsEquivalent(actual: string, expected: string) {
  const normalizedActual = normalizedAnswer(actual);
  const normalizedExpected = normalizedAnswer(expected);
  if (normalizedActual === normalizedExpected || normalizedActual.includes(normalizedExpected)) return true;
  const expectedTokens = [...tokens(expected)];
  const actualTokens = tokens(actual);
  return expectedTokens.length > 1 && expectedTokens.every((token) => actualTokens.has(token));
}

function equivalent(row: Dv11BenchmarkRow, actual: string) {
  const expected = row.expected;
  if (expected.numeric) {
    const parsedValues = parseNumeric(actual);
    if (!parsedValues.length) return false;
    const expectedUnit = expected.numeric.unit ? unitTable[expected.numeric.unit.toLocaleLowerCase("en-US")] : undefined;
    const target = expectedUnit ? expected.numeric.value * expectedUnit.scale : expected.numeric.value;
    const tolerance = Math.max(expected.numeric.tolerance ?? 0, Math.abs(target) * (expected.numeric.relativeTolerance ?? 0));
    return parsedValues.some((parsed) => (!expectedUnit?.dimension || !parsed.dimension || expectedUnit.dimension === parsed.dimension) && Math.abs(parsed.value - target) <= tolerance);
  }
  if (expected.unorderedSet) {
    const actualItems = new Set(listItems(actual));
    return expected.unorderedSet.every((item) => actualItems.has(normalizedAnswer(item))) && actualItems.size === expected.unorderedSet.length;
  }
  if (expected.orderedList) {
    const expectedItems = expected.orderedList.map(normalizedAnswer);
    const normalizedActual = normalizedAnswer(actual);
    let cursor = 0;
    return expectedItems.every((item) => {
      const index = normalizedActual.indexOf(item, cursor);
      if (index < 0) return false;
      cursor = index + item.length;
      return true;
    });
  }
  const alternatives = [expected.canonical, ...(expected.aliases ?? [])].filter((item): item is string => Boolean(item));
  if (alternatives.some((item) => containsEquivalent(actual, item))) return true;
  if (expected.paraphraseConcepts?.every((group) => group.some((concept) => containsEquivalent(actual, concept)))) return true;
  return false;
}

const abstentionPattern = /\b(?:do not have|don't have|cannot answer|not enough|unknown|unsupported|no compatible proposition|unable to determine)\b/i;
const clarificationPattern = /\b(?:clarify|which .+ do you mean|please specify|need .+ (?:subject|object|time|unit|sense))\b/i;

export function gradeDv11Response(row: Dv11BenchmarkRow, actual: string, status?: string): Dv11Grade {
  try {
    const isClarification = status === "ambiguous" || clarificationPattern.test(actual);
    const isAbstention = ["unknown", "insufficient"].includes(status ?? "") || abstentionPattern.test(actual);
    const canonical = row.expected.canonical ? normalizedAnswer(row.expected.canonical) : "";
    const normalizedActual = normalizedAnswer(actual);
    const escapedCanonical = canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const explicitDenial = Boolean(canonical && new RegExp(`\\b(?:not|never)\\b.{0,24}${escapedCanonical}`).test(normalizedActual));
    const isEquivalent = !isAbstention && !isClarification && !explicitDenial && equivalent(row, actual);
    let outcome: Dv11EvaluationOutcome;
    if (isEquivalent) outcome = "correct-answer";
    else if (isClarification) outcome = "clarification";
    else if (isAbstention) outcome = row.answerable ? "unsupported-abstention" : "correct-abstention";
    else if (row.expected.unorderedSet || row.expected.orderedList || row.expected.paraphraseConcepts) {
      const expectedTokens = new Set([...(row.expected.unorderedSet ?? []), ...(row.expected.orderedList ?? []), ...(row.expected.paraphraseConcepts?.flat(2) ?? [])].flatMap((item) => [...tokens(String(item))]));
      const actualTokens = tokens(actual);
      outcome = [...expectedTokens].some((token) => actualTokens.has(token)) ? "partial-answer" : "incorrect-answer";
    } else outcome = "incorrect-answer";
    const uncertain = !isEquivalent && !isAbstention && !isClarification && normalizedAnswer(actual).length > 0;
    return { outcome, equivalent: isEquivalent, reason: `semantic:${outcome}`, requiresHumanAdjudication: uncertain, normalizedExpected: row.expected.canonical ? normalizedAnswer(row.expected.canonical) : undefined, normalizedActual };
  } catch (error) {
    return { outcome: "evaluator-error", equivalent: false, reason: error instanceof Error ? error.message : String(error), requiresHumanAdjudication: true, normalizedActual: normalizedAnswer(actual) };
  }
}

export function answerPossibility(rows: readonly Dv11BenchmarkRow[]) {
  const answerable = rows.filter((row) => row.answerable);
  const correct = answerable.filter((row) => row.outcome === "correct-answer").length;
  return { correct, answerable: answerable.length, rate: answerable.length ? correct / answerable.length : 0 };
}

export function summarizeDv11Rows(rows: readonly Dv11BenchmarkRow[]) {
  const categories = Object.fromEntries([...new Set(rows.map((row) => row.category))].map((category) => {
    const selected = rows.filter((row) => row.category === category);
    const answerable = selected.filter((row) => row.answerable);
    const correct = answerable.filter((row) => row.outcome === "correct-answer").length;
    return [category, { samples: selected.length, answerable: answerable.length, correctAnswers: correct, answerPossibility: answerable.length ? correct / answerable.length : null, outcomes: Object.fromEntries(dv11OutcomeLabels.map((outcome) => [outcome, selected.filter((row) => row.outcome === outcome).length])) }];
  }));
  return { samples: rows.length, answerPossibility: answerPossibility(rows), categories };
}

export function hashDv11Row(row: Omit<Dv11BenchmarkRow, "immutableHash" | "outcome" | "adjudication">) {
  return createHash("sha256").update(JSON.stringify(row)).digest("hex");
}

export async function loadDv11Jsonl(path: string): Promise<Dv11BenchmarkRow[]> {
  const bytes = await readFile(path);
  const data = path.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
  return data.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith("#")).map((line, index) => {
    const row = JSON.parse(line) as Dv11BenchmarkRow;
    if (!dv11OutcomeLabels.includes(row.outcome as Dv11EvaluationOutcome) && row.outcome !== undefined) throw new Error(`Invalid outcome on row ${index + 1}.`);
    return row;
  });
}

export function dv11EvaluatorMutationCases(row: Dv11BenchmarkRow) {
  const canonical = row.expected.canonical ?? "";
  return [
    { kind: "equivalent-alias", answer: row.expected.aliases?.[0] ?? canonical, shouldPass: true },
    { kind: "denial", answer: `It is not ${canonical}.`, shouldPass: false },
    { kind: "incidental-mention", answer: `I cannot answer; someone mentioned ${canonical}.`, shouldPass: false },
    ...(row.expected.unorderedSet ? [{ kind: "reordered-set", answer: [...row.expected.unorderedSet].reverse().join(", "), shouldPass: true }] : []),
    ...(row.expected.orderedList ? [{ kind: "reordered-list", answer: [...row.expected.orderedList].reverse().join(", "), shouldPass: false }] : []),
  ];
}
