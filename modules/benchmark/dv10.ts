import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { performance } from "node:perf_hooks";
import { createGunzip } from "node:zlib";
import { createLexiSession } from "@/lib/lexi/engine";
import { parseDv10Plan } from "@/modules/dv10";
import manifest from "@/data/dv10/benchmarks/manifest.json";

type FrozenFailure = {
  id: string;
  question: string;
  expectedAnswer: string;
  category: string;
  difficulty: string;
  answerability: "answerable" | "unanswerable";
  baseline: {
    outcome: string;
    failureReason: string;
    confidence: number;
  };
};

type Outcome = "correct-answer" | "correct-abstention" | "incorrect-answer" | "unsupported-abstention" | "clarification";

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function expectedAppears(text: string, expectedAnswer: string) {
  const rendered = normalize(text);
  const expected = normalize(expectedAnswer);
  if (expected === "true") return /\b(?:true|yes|correct)\b/.test(rendered);
  if (expected === "false") return /\b(?:false|no|incorrect)\b/.test(rendered);
  return Boolean(expected) && ` ${rendered} `.includes(` ${expected} `);
}

function outcomeFor(row: FrozenFailure, text: string, source: string, intent: string): Outcome {
  if (row.answerability === "answerable" && expectedAppears(text, row.expectedAnswer)) return "correct-answer";
  const rendered = normalize(text);
  const clarification = intent.includes("clarification") || /\b(?:which .* do you mean|add a type|name the exact|please name)\b/.test(rendered);
  const abstention = source === "safe-fallback" || /\b(?:cannot connect|do not have|could not form|do not know|unsupported|no recorded|cannot answer)\b/.test(rendered);
  if (row.answerability === "unanswerable" && abstention) return "correct-abstention";
  if (clarification) return "clarification";
  if (abstention) return "unsupported-abstention";
  return "incorrect-answer";
}

async function* frozenRows(limit = Number.POSITIVE_INFINITY): AsyncGenerator<FrozenFailure> {
  const file = path.join(process.cwd(), manifest.artifact.path);
  const input = createReadStream(file).pipe(createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let count = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    yield JSON.parse(line) as FrozenFailure;
    count += 1;
    if (count >= limit) break;
  }
}

const senseFrames = [
  (term: string, context: string) => `What does ${term} mean in ${context}?`,
  (term: string, context: string) => `Define ${term} in the context of ${context}.`,
  (term: string, context: string) => `What is the meaning of ${term} in ${context}?`,
  (term: string, context: string) => `In ${context}, what does the word ${term} mean?`,
  (term: string, context: string) => `Explain ${term} as used in ${context}.`,
];

const senseCases = Array.from({ length: 100 }, (_, index) => {
  const contexts = [
    { context: "a river", expected: "sloping land" },
    { context: "finance", expected: "financial institution" },
  ];
  const selected = contexts[index % contexts.length];
  return { prompt: senseFrames[index % senseFrames.length]("bank", selected.context), expected: selected.expected };
});

const calibrationCases = [
  "What is the shoe size of Mars?",
  "What is the favorite color of mathematics?",
  "Who is Jordan?",
  "When did water decide to become wet?",
  "What is the birthday of the number seven?",
  "Which bank do I mean?",
  "What was the Moon thinking yesterday?",
  "Give the exact current temperature everywhere on Earth.",
  "Which unnamed person invented that unnamed object?",
  "What is the capital of an unspecified country?",
];

const dialogueScenarios = Array.from({ length: 100 }, (_, index) => {
  if (index % 2 === 0) return [
    "What does bank mean in a river?",
    "No, I meant finance.",
    "How do you know?",
  ];
  return [
    "Tell me something interesting about Saturn.",
    "How do you know?",
  ];
});

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export async function validateDv10BenchmarkArtifact() {
  const bytes = await readFile(path.join(process.cwd(), manifest.artifact.path));
  const hash = createHash("sha256").update(bytes).digest("hex");
  let rows = 0;
  for await (const row of frozenRows()) {
    if (row.id) rows += 1;
  }
  return {
    valid: hash === manifest.artifact.sha256 && rows === manifest.artifact.frozenFailureCount && manifest.importedByRuntime === false,
    hash,
    rows,
  };
}

export async function runDv10Benchmark(options: { limit?: number } = {}) {
  const limit = options.limit ?? manifest.artifact.frozenFailureCount;
  const publicRoot = path.join(process.cwd(), "public");
  const fetcher = async (source: string) => {
    try {
      return new Response(await readFile(path.join(publicRoot, source.replace(/^\//, ""))), { status: 200 });
    } catch {
      return new Response("missing", { status: 404 });
    }
  };
  const outcomes: Record<Outcome, number> = {
    "correct-answer": 0,
    "correct-abstention": 0,
    "incorrect-answer": 0,
    "unsupported-abstention": 0,
    clarification: 0,
  };
  const failureReasons: Record<string, number> = {};
  const latency: number[] = [];
  let total = 0;
  let recognizedPlans = 0;
  let confidentIncorrect = 0;
  let reasoningTotal = 0;
  let reasoningCorrect = 0;
  const failures: Array<{ id: string; question: string; expected: string; received: string; outcome: Outcome }> = [];
  for await (const row of frozenRows(limit)) {
    const started = performance.now();
    const reply = await createLexiSession().respondAsync(row.question, { fetcher });
    latency.push(performance.now() - started);
    const outcome = outcomeFor(row, reply.text, reply.trace.source, reply.trace.interpretedIntent);
    outcomes[outcome] += 1;
    total += 1;
    if (parseDv10Plan(row.question) || reply.trace.interpretedIntent !== "unknown") recognizedPlans += 1;
    const reasoning = /mathematics/i.test(row.category) || /\b(?:calculate|how many|sum|times|divided|percent|sequence)\b/i.test(row.question);
    if (reasoning) {
      reasoningTotal += 1;
      if (outcome === "correct-answer") reasoningCorrect += 1;
    }
    if (outcome === "incorrect-answer" && reply.trace.confidence >= 0.8) confidentIncorrect += 1;
    if (outcome !== "correct-answer" && failures.length < 100) {
      failures.push({ id: row.id, question: row.question, expected: row.expectedAnswer, received: reply.text, outcome });
    }
    const reason = outcome === "correct-answer" ? "resolved" : row.baseline.failureReason;
    failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
  }

  let sensePassed = 0;
  for (const row of senseCases) {
    const reply = await createLexiSession().respondAsync(row.prompt, { fetcher });
    if (normalize(reply.text).includes(normalize(row.expected))) sensePassed += 1;
  }

  let dialoguePassed = 0;
  for (const turns of dialogueScenarios) {
    const session = createLexiSession();
    const replies = [];
    for (const turn of turns) replies.push(await session.respondAsync(turn, { fetcher }));
    const passed = turns.length === 3
      ? /financial institution/i.test(replies[1].text) && replies[2].trace.interpretedIntent === "dv10:proof"
      : replies[0].trace.source === "semantic-runtime" && replies[1].trace.interpretedIntent === "dv10:proof";
    if (passed) dialoguePassed += 1;
  }

  let calibrationPassed = 0;
  for (const prompt of calibrationCases) {
    const reply = await createLexiSession().respondAsync(prompt, { fetcher });
    if (reply.trace.source === "safe-fallback" || /clarif|unknown/.test(reply.trace.interpretedIntent) || /\b(?:do not have|cannot|which .* mean|name the exact)\b/i.test(reply.text)) {
      calibrationPassed += 1;
    }
  }

  const answerableCorrectness = total ? outcomes["correct-answer"] / total : 0;
  const confidentIncorrectRate = total ? confidentIncorrect / total : 0;
  const senseRate = sensePassed / senseCases.length;
  const dialogueRate = dialoguePassed / dialogueScenarios.length;
  return {
    build: "260811-DV10",
    evaluationBoundary: "2,500 frozen human-contributed DV9 failures; expected answers are evaluation-only",
    total,
    outcomes,
    failureReasons,
    measurements: {
      knowledge: answerableCorrectness,
      languageRobustness: total ? recognizedPlans / total : 0,
      reasoning: reasoningTotal ? reasoningCorrect / reasoningTotal : 0,
      dialogue: dialogueRate,
      precision: calibrationPassed / calibrationCases.length,
      senseSelection: senseRate,
      confidentIncorrectRate,
      latencyP50Milliseconds: percentile(latency, 0.5),
      latencyP95Milliseconds: percentile(latency, 0.95),
    },
    targets: {
      ordinaryCorrectness: { minimum: 0.88, stretch: 0.92, actual: answerableCorrectness, met: answerableCorrectness >= 0.88 },
      confidentIncorrect: { maximum: 0.007, stretch: 0.004, actual: confidentIncorrectRate, met: confidentIncorrectRate <= 0.007 },
      senseSelection: { minimum: 0.95, stretch: 0.98, actual: senseRate, met: senseRate >= 0.95 },
      dialogue: { minimum: 0.92, stretch: 0.95, actual: dialogueRate, met: dialogueRate >= 0.92 },
    },
    failures,
  };
}
