import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createLexiSession } from "../lib/lexi/engine.ts";

const root = process.cwd();
const sourcePath = process.argv[2] ?? "/private/tmp/open-trivia-all.json";
const outputRoot = path.join(root, "data/dv10/benchmarks");
const outputPath = path.join(outputRoot, "frozen-human-failures.jsonl.gz");
const manifestPath = path.join(outputRoot, "manifest.json");
const FAILURE_TARGET = 2_500;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function normalize(value) {
  return decodeHtml(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function expectedAnswerAppears(text, answer) {
  const rendered = normalize(text);
  const expected = normalize(answer);
  if (!expected) return false;
  if (expected === "true") return /\b(?:true|yes|correct)\b/.test(rendered);
  if (expected === "false") return /\b(?:false|no|incorrect)\b/.test(rendered);
  return ` ${rendered} `.includes(` ${expected} `);
}

function classifyOutcome(reply, expectedAnswer) {
  if (expectedAnswerAppears(reply.text, expectedAnswer)) return "correct-answer";
  const normalized = normalize(reply.text);
  if (
    reply.trace.interpretedIntent.includes("clarification") ||
    /\b(?:add a type|name the exact|please name|which .* do you mean|more than one recorded meaning)\b/.test(normalized)
  ) return "clarification";
  if (
    reply.trace.source === "safe-fallback" ||
    /\b(?:cannot connect|do not have|could not form|do not know|unsupported|no recorded|cannot answer)\b/.test(normalized)
  ) return "unsupported-abstention";
  return "incorrect-answer";
}

function failureReason(reply, question, outcome) {
  const normalized = normalize(question);
  if (reply.trace.source === "context-pattern" || reply.trace.source === "exact-example" || reply.trace.source === "combined-response") {
    return "routing";
  }
  if (reply.trace.source === "dv9-data-engine" && /\b(?:mean|sense|context|word|term)\b/.test(normalized)) {
    return "sense";
  }
  if (/\b(?:calculate|sum|difference|times|divided|percent|sequence|if all|how many)\b/.test(normalized)) {
    return "reasoning";
  }
  if (outcome === "clarification") return "parsing";
  if (outcome === "unsupported-abstention") {
    return reply.trace.interpretedIntent === "unknown" ? "parsing" : "knowledge";
  }
  if (reply.trace.confidence >= 0.8) return "calibration";
  return "realization";
}

const sourceBytes = await readFile(sourcePath);
const sourceRows = JSON.parse(sourceBytes.toString("utf8"));
if (!Array.isArray(sourceRows) || sourceRows.length < FAILURE_TARGET) {
  throw new Error(`Expected at least ${FAILURE_TARGET} OpenTDB rows.`);
}

const publicRoot = path.join(root, "public");
const fetcher = async (source) => {
  try {
    return new Response(await readFile(path.join(publicRoot, source.replace(/^\//, ""))), { status: 200 });
  } catch {
    return new Response("missing", { status: 404 });
  }
};

const failures = [];
const baselineOutcomes = {};
const failureReasons = {};
for (let sourceIndex = 0; sourceIndex < sourceRows.length && failures.length < FAILURE_TARGET; sourceIndex += 1) {
  const source = sourceRows[sourceIndex];
  const question = decodeHtml(source.question);
  const expectedAnswer = decodeHtml(source.correct_answer);
  const session = createLexiSession();
  const reply = await session.respondAsync(question, { fetcher });
  const outcome = classifyOutcome(reply, expectedAnswer);
  baselineOutcomes[outcome] = (baselineOutcomes[outcome] ?? 0) + 1;
  if (outcome === "correct-answer") continue;
  const reason = failureReason(reply, question, outcome);
  failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
  failures.push({
    id: `opentdb:${sha256(`${question}\u0000${expectedAnswer}`).slice(0, 20)}`,
    sourceIndex,
    question,
    expectedAnswer,
    incorrectAnswers: (source.incorrect_answers ?? []).map(decodeHtml),
    category: decodeHtml(source.category),
    difficulty: source.difficulty,
    answerability: "answerable",
    baseline: {
      build: "260802-DV9",
      outcome,
      failureReason: reason,
      source: reply.trace.source,
      intent: reply.trace.interpretedIntent,
      confidence: reply.trace.confidence,
      text: reply.text,
    },
  });
}

if (failures.length !== FAILURE_TARGET) {
  throw new Error(`Only ${failures.length} genuine failures were found; ${FAILURE_TARGET} are required.`);
}

await mkdir(outputRoot, { recursive: true });
const lines = `${failures.map((row) => JSON.stringify(row)).join("\n")}\n`;
const compressed = gzipSync(lines, { level: 9 });
await writeFile(outputPath, compressed);
const manifest = {
  schemaVersion: 1,
  build: "260811-DV10",
  frozenAt: "2026-08-11",
  importedByRuntime: false,
  leakagePolicy: "This artifact is evaluation-only. Runtime modules and development packs must not import it or its answers.",
  source: {
    name: "Open Trivia Database human-contributed question snapshot",
    upstreamRepository: "https://github.com/leakyhose/open-trivia-script-data",
    upstreamPath: "data/all_questions.json",
    upstreamBlob: "9a095a65cc7427b4e49e55eef1db3923fed55226",
    canonicalProvider: "https://opentdb.com/",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sourceSha256: sha256(sourceBytes),
    sourceQuestionCount: sourceRows.length,
  },
  artifact: {
    path: path.relative(root, outputPath),
    sha256: sha256(compressed),
    frozenFailureCount: failures.length,
  },
  dv9Baseline: {
    evaluatedUntilSourceIndex: failures.at(-1).sourceIndex,
    outcomes: baselineOutcomes,
    failureReasons,
  },
  outcomeClasses: [
    "correct-answer",
    "correct-abstention",
    "incorrect-answer",
    "unsupported-abstention",
    "clarification",
  ],
  failureClasses: [
    "knowledge",
    "parsing",
    "sense",
    "routing",
    "reasoning",
    "dialogue",
    "realization",
    "calibration",
  ],
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
