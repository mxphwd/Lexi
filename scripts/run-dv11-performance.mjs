import { performance } from "node:perf_hooks";
import { createLexiSession, respond, respondAsync } from "../lib/lexi/engine.ts";
import { dv9ShardCacheStats } from "../modules/dv9/loader.ts";
import { readFile } from "node:fs/promises";

const prompts = {
  factual: "What is mathematics?",
  arithmetic: "What is 17 percent of 240?",
  multiClause: "What is gravity, why is it important, and give me an example?",
  ambiguity: "What does bank mean?",
};

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0;
}

function measure(label, task, samples = 100) {
  const durations = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    task();
    durations.push(performance.now() - started);
  }
  return { label, samples, p50Milliseconds: percentile(durations, 0.5), p95Milliseconds: percentile(durations, 0.95), p99Milliseconds: percentile(durations, 0.99) };
}

const before = process.memoryUsage();
const coldStart = measure("cold-start", () => respond(prompts.factual), 1);
const routeMeasurements = Object.entries(prompts).map(([route, prompt]) => measure(route, () => respond(prompt)));
const session = createLexiSession();
let deterministicTurn = 0;
const longSession = measure("long-session", () => session.respond(`What is math? turn ${deterministicTurn += 1}`), 256);
const localFetcher = async (source) => {
  try { return new Response(new Uint8Array(await readFile(new URL(`../public${source}`, import.meta.url))), { status: 200 }); }
  catch { return new Response("missing", { status: 404 }); }
};
const lexicalStarted = performance.now();
await respondAsync("What does bank mean in finance?", { fetcher: localFetcher });
const lexicalShardMilliseconds = performance.now() - lexicalStarted;
const after = process.memoryUsage();
console.log(JSON.stringify({ release: "DV11", measurements: [coldStart, ...routeMeasurements, longSession], lexicalShard: { milliseconds: lexicalShardMilliseconds, cache: dv9ShardCacheStats() }, memory: { before, after, peakResidentSetBytes: Math.max(before.rss, after.rss), heapGrowthBytes: after.heapUsed - before.heapUsed } }, null, 2));
