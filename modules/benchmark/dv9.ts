import { performance } from "node:perf_hooks";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import { Dv9DialogueState, matchDv9Data, parseDv9LexicalPlan } from "@/modules/dv9";
import manifest from "@/data/dv9/manifest.json";

type BlindRow = readonly [
  id: string,
  prompt: string,
  expected: { operation: string; term: string; expectedSenseId: string | null; expectedToken: string | null },
  isolation: { origin: string; importedByRuntime: false; frame: string },
];

async function* blindRows(): AsyncGenerator<BlindRow> {
  const file = path.join(process.cwd(), manifest.artifacts.heldOutBlindQuestions.path);
  const input = createReadStream(file).pipe(createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) yield JSON.parse(line) as BlindRow;
}

async function* dialogueRows(): AsyncGenerator<readonly [string, { term: string; turns: Array<readonly ["user" | "lexi", string]> }]> {
  const file = path.join(process.cwd(), manifest.artifacts.dialogueScenarios.path);
  const input = createReadStream(file).pipe(createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) if (line.trim()) yield JSON.parse(line);
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export async function runDv9Benchmark() {
  let total = 0;
  let parsed = 0;
  const failures: Array<{ id: string; prompt: string; reason: string }> = [];
  const latency: number[] = [];
  const endToEndRows: BlindRow[] = [];
  for await (const row of blindRows()) {
    const [, prompt, expected] = row;
    const start = performance.now();
    const plan = parseDv9LexicalPlan(prompt);
    if (latency.length < 1_000) latency.push(performance.now() - start);
    total += 1;
    if (plan?.operation === expected.operation && plan.term === expected.term) parsed += 1;
    else if (failures.length < 100) failures.push({ id: row[0], prompt, reason: `Expected ${expected.operation}:${expected.term}; received ${plan?.operation}:${plan?.term}.` });
    if (endToEndRows.length < 1_000 && total % 37 === 0) endToEndRows.push(row);
  }

  const publicRoot = path.join(process.cwd(), "public");
  const fetcher = async (source: string) => {
    try {
      return new Response(await readFile(path.join(publicRoot, source.replace(/^\//, ""))), { status: 200 });
    } catch {
      return new Response("missing", { status: 404 });
    }
  };
  let endToEndPassed = 0;
  const dialogue = new Dv9DialogueState();
  for (const [, prompt, expected] of endToEndRows) {
    const result = await matchDv9Data(prompt, { fetcher }, dialogue);
    if (
      result?.plan.operation === expected.operation &&
      result.plan.term === expected.term &&
      result.reply.trace.source === "dv9-data-engine"
    ) endToEndPassed += 1;
  }

  let dialogueTotal = 0;
  let dialoguePassed = 0;
  const dialogueFailures: Array<{ id: string; prompt: string }> = [];
  for await (const [scenarioId, scenario] of dialogueRows()) {
    const state = new Dv9DialogueState();
    let scenarioPassed = true;
    for (const [speaker, text] of scenario.turns) {
      if (speaker !== "user") continue;
      const immediate = state.interpret(text);
      if (immediate) continue;
      const plan = parseDv9LexicalPlan(text, state.snapshot());
      if (!plan) {
        scenarioPassed = false;
        if (dialogueFailures.length < 100) dialogueFailures.push({ id: scenarioId, prompt: text });
        break;
      }
      state.record(plan);
    }
    dialogueTotal += 1;
    if (scenarioPassed) dialoguePassed += 1;
  }

  return {
    data: manifest.counts,
    heldOutLanguage: {
      passed: parsed,
      total,
      rate: total ? parsed / total : 0,
      origin: "source-derived held-out frames; not user-reported failures",
    },
    endToEndLexical: {
      passed: endToEndPassed,
      total: endToEndRows.length,
      rate: endToEndRows.length ? endToEndPassed / endToEndRows.length : 0,
    },
    dialoguePlans: {
      passed: dialoguePassed,
      total: dialogueTotal,
      rate: dialogueTotal ? dialoguePassed / dialogueTotal : 0,
    },
    parserLatency: {
      samples: latency.length,
      p50Milliseconds: percentile(latency, 0.5),
      p95Milliseconds: percentile(latency, 0.95),
    },
    failures,
    dialogueFailures,
  };
}
