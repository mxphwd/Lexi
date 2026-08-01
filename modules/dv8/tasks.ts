import type { QueryPlan } from "./types";

export type TaskResult = {
  text: string;
  evidence: string[];
  structureId: string;
};

const unitScale: Readonly<Record<string, { family: string; scale: number; label: string }>> = {
  mm: { family: "length", scale: 0.001, label: "millimeters" },
  millimeter: { family: "length", scale: 0.001, label: "millimeters" },
  millimeters: { family: "length", scale: 0.001, label: "millimeters" },
  cm: { family: "length", scale: 0.01, label: "centimeters" },
  centimeter: { family: "length", scale: 0.01, label: "centimeters" },
  centimeters: { family: "length", scale: 0.01, label: "centimeters" },
  m: { family: "length", scale: 1, label: "meters" },
  meter: { family: "length", scale: 1, label: "meters" },
  meters: { family: "length", scale: 1, label: "meters" },
  km: { family: "length", scale: 1000, label: "kilometers" },
  kilometer: { family: "length", scale: 1000, label: "kilometers" },
  kilometers: { family: "length", scale: 1000, label: "kilometers" },
  g: { family: "mass", scale: 0.001, label: "grams" },
  gram: { family: "mass", scale: 0.001, label: "grams" },
  grams: { family: "mass", scale: 0.001, label: "grams" },
  kg: { family: "mass", scale: 1, label: "kilograms" },
  kilogram: { family: "mass", scale: 1, label: "kilograms" },
  kilograms: { family: "mass", scale: 1, label: "kilograms" },
  second: { family: "time", scale: 1, label: "seconds" },
  seconds: { family: "time", scale: 1, label: "seconds" },
  minute: { family: "time", scale: 60, label: "minutes" },
  minutes: { family: "time", scale: 60, label: "minutes" },
  hour: { family: "time", scale: 3600, label: "hours" },
  hours: { family: "time", scale: 3600, label: "hours" },
};

const translations: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  spanish: {
    hello: "hola", goodbye: "adiós", "thank you": "gracias", please: "por favor",
    yes: "sí", no: "no", water: "agua", friend: "amigo",
  },
  french: {
    hello: "bonjour", goodbye: "au revoir", "thank you": "merci", please: "s'il vous plaît",
    yes: "oui", no: "non", water: "eau", friend: "ami",
  },
};

function formattedNumber(value: number) {
  return Number.isInteger(value) ? String(value) : Number(value.toFixed(8)).toString();
}

function convert(payload: string): TaskResult {
  const [source, targetRaw] = payload.split("|");
  const match = source.match(/^(-?\d+(?:\.\d+)?)\s*([a-z]+)$/);
  const target = unitScale[targetRaw];
  const from = match ? unitScale[match[2]] : undefined;
  if (!match || !from || !target || from.family !== target.family) {
    return {
      text: "I cannot convert those units mechanically. I support common length, mass, and time units when both units belong to the same measurement family.",
      evidence: ["task:conversion:unsupported-units"],
      structureId: "dv8-task:convert:abstain",
    };
  }
  const result = Number(match[1]) * from.scale / target.scale;
  return {
    text: `${match[1]} ${from.label} equals ${formattedNumber(result)} ${target.label}.`,
    evidence: ["task:conversion:dimension-compatible", `scale:${from.scale}/${target.scale}`],
    structureId: "dv8-task:convert",
  };
}

function sortValues(payload: string): TaskResult {
  const values = payload.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (values.length < 2) {
    return {
      text: "Give me at least two explicit numbers to sort.",
      evidence: ["task:sort:insufficient-values"],
      structureId: "dv8-task:sort:abstain",
    };
  }
  const descending = /\b(?:descending|largest|highest)\b/.test(payload);
  values.sort((left, right) => descending ? right - left : left - right);
  return {
    text: `${descending ? "Descending" : "Ascending"} order: ${values.map(formattedNumber).join(", ")}.`,
    evidence: ["task:sort:numeric", `items:${values.length}`],
    structureId: "dv8-task:sort",
  };
}

function grammar(payload: string): TaskResult {
  let corrected = payload.replace(/^['"]|['"]$/g, "").trim();
  const rules: Array<[RegExp, string]> = [
    [/\bi is\b/gi, "I am"],
    [/\b(he|she|it) are\b/gi, "$1 is"],
    [/\b(they|we|you) is\b/gi, "$1 are"],
    [/\b(he|she|it) have\b/gi, "$1 has"],
    [/\bdoes not ([a-z]+)s\b/gi, "does not $1"],
    [/\bdid not ([a-z]+)ed\b/gi, "did not $1"],
  ];
  for (const [pattern, replacement] of rules) corrected = corrected.replace(pattern, replacement);
  corrected = corrected.replace(/\s+([,.!?])/g, "$1");
  if (corrected) corrected = corrected[0].toUpperCase() + corrected.slice(1);
  if (corrected && !/[.!?]$/.test(corrected)) corrected += ".";
  return {
    text: corrected || "I need a sentence to correct.",
    evidence: ["task:grammar:bounded-agreement-and-punctuation"],
    structureId: "dv8-task:grammar",
  };
}

function translate(payload: string): TaskResult {
  const match = payload.match(/^(.+?)\s+(spanish|french|english)$/);
  if (!match) return { text: "State a supported phrase and target language.", evidence: ["task:translate:missing-target"], structureId: "dv8-task:translate:abstain" };
  const phrase = match[1].replace(/^['"]|['"]$/g, "").trim();
  const language = match[2];
  const translated = translations[language]?.[phrase];
  if (!translated) {
    return {
      text: `I do not have a reviewed ${language} translation for “${phrase}.” My translation table is intentionally bounded.`,
      evidence: ["task:translate:calibrated-abstention"],
      structureId: "dv8-task:translate:abstain",
    };
  }
  return {
    text: `“${phrase}” in ${language[0].toUpperCase() + language.slice(1)} is “${translated}.”`,
    evidence: ["task:translate:reviewed-table"],
    structureId: "dv8-task:translate",
  };
}

function summarize(payload: string): TaskResult {
  const clean = payload.replace(/^['"]|['"]$/g, "").trim();
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const first = sentences[0]?.replace(/\b(?:very|really|quite|basically|actually)\b/gi, "").replace(/\s+/g, " ").trim();
  return {
    text: first
      ? `Summary: ${first}${/[.!?]$/.test(first) ? "" : "."}`
      : "I need explicit text to summarize.",
    evidence: ["task:summarize:extractive-first-proposition"],
    structureId: "dv8-task:summarize",
  };
}

export function executeTask(plan: QueryPlan): TaskResult | undefined {
  const transform = plan.transform;
  if (!transform) return undefined;
  if (transform.task === "convert") return convert(transform.payload);
  if (transform.task === "sort") return sortValues(transform.payload);
  if (transform.task === "grammar") return grammar(transform.payload);
  if (transform.task === "translate") return translate(transform.payload);
  if (transform.task === "summarize") return summarize(transform.payload);
  if (transform.task === "rewrite") {
    const clean = transform.payload.replace(/^['"]|['"]$/g, "").trim();
    return { text: clean ? `Rephrased: ${clean}` : "I need text to rephrase.", evidence: ["task:rewrite:conservative-preservation"], structureId: "dv8-task:rewrite" };
  }
  const word = transform.payload.replace(/^['"]|['"]$/g, "").trim();
  return {
    text: word ? `Example: “The writer used the word ${word} precisely in the sentence.”` : "I need a word.",
    evidence: ["task:sentence:bounded-frame"],
    structureId: "dv8-task:sentence",
  };
}
