import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createLexiSession, respondAsync } from "@/lib/lexi/engine";
import { runDv9Benchmark } from "@/modules/benchmark";
import {
  dv9DataManifest,
  dv9EngineStats,
  matchDv9Data,
  parseDv9LexicalPlan,
  validateDv9Manifest,
} from "@/modules/dv9";

const localDv9Fetcher = async (source: string) => {
  try {
    const file = new URL(`../public${source}`, import.meta.url);
    return new Response(new Uint8Array(await readFile(file)), { status: 200 });
  } catch {
    return new Response("missing", { status: 404 });
  }
};

test("meets the DV9 data targets without relabeling source-attested rows", () => {
  const validation = validateDv9Manifest();
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(dv9DataManifest.counts.validatedAtomicFacts, 800_000);
  assert.ok(dv9DataManifest.counts.entities >= 300_000);
  assert.ok(dv9DataManifest.counts.entities <= 400_000);
  assert.ok(dv9DataManifest.counts.explicitLexicalSenses >= 150_000);
  assert.ok(dv9DataManifest.counts.explicitLexicalSenses <= 200_000);
  assert.equal(dv9DataManifest.counts.typedRelationProfiles, 3_200);
  assert.equal(dv9DataManifest.counts.queryPlanExamples, 100_000);
  assert.equal(dv9DataManifest.counts.inferenceRules, 1_100);
  assert.equal(dv9DataManifest.counts.dialogueScenarios, 40_000);
  assert.equal(dv9DataManifest.counts.heldOutBlindQuestions, 40_000);
  assert.equal(dv9DataManifest.counts.directFinishedConstructions, 0);
  assert.equal(dv9DataManifest.counts.independentlyReviewedNewFacts, 0);
  assert.equal(dv9EngineStats().valid, true);
});

test("maps lexical language into explicit DV9 plans", () => {
  const contextual = parseDv9LexicalPlan("What does bank mean in finance?");
  assert.equal(contextual?.operation, "define");
  assert.equal(contextual?.term, "bank");
  assert.equal(contextual?.contextHint, "finance");

  const ambiguous = parseDv9LexicalPlan("List the meanings of bank.");
  assert.equal(ambiguous?.operation, "list-senses");
  assert.equal(ambiguous?.term, "bank");

  const punctuation = parseDv9LexicalPlan("How is ph.d. defined in the embedded lexicon?");
  assert.equal(punctuation?.term, "ph.d.");
});

test("loads one lexical shard and realizes explicit senses with provenance", async () => {
  const result = await matchDv9Data(
    "What does bank mean in finance?",
    { fetcher: localDv9Fetcher },
  );
  assert.equal(result?.reply.trace.source, "dv9-data-engine");
  assert.equal(result?.reply.trace.interpretedIntent, "dv9:define");
  assert.match(result?.reply.text ?? "", /financial institution/);
  assert.ok(result?.reply.trace.matchedExampleIds.some((id) => id.startsWith("wordset:")));
  assert.ok(result?.reply.trace.proof?.some((step) => /source-attested/i.test(step)));
});

test("supports lexical proposition follow-ups and conversational goals", async () => {
  const session = createLexiSession();
  const options = { fetcher: localDv9Fetcher };
  assert.equal((await session.respondAsync("List the meanings of bank.", options)).trace.source, "dv9-data-engine");
  assert.match((await session.respondAsync("What part of speech is it?", options)).text, /noun/);
  assert.match((await session.respondAsync("Use it in an example.", options)).text, /Recorded example/);
  assert.match((await session.respondAsync("What is related to it?", options)).text, /Moby associates/);
  assert.match((await session.respondAsync("Where did that come from?", options)).text, /Wordset entry/);
  assert.equal(
    (await session.respondAsync("What are we discussing?", options)).text,
    "The active lexical subject is “bank”.",
  );
  assert.equal(session.snapshot().lexicalDialogue.activeTerm, "bank");
});

test("keeps curated DV8 propositions ahead of generic dictionary definitions", async () => {
  const reply = await respondAsync("What is mathematics?", { fetcher: localDv9Fetcher });
  assert.equal(reply.trace.source, "language-engine");
  assert.equal(reply.trace.interpretedIntent, "definition");
});

test("passes the isolated DV9 language suite and end-to-end lexical sample", async () => {
  const report = await runDv9Benchmark();
  assert.equal(report.heldOutLanguage.total, 40_000);
  assert.equal(report.heldOutLanguage.passed, 40_000);
  assert.equal(report.heldOutLanguage.rate, 1);
  assert.equal(report.endToEndLexical.total, 1_000);
  assert.equal(report.endToEndLexical.passed, 1_000);
  assert.equal(report.dialoguePlans.total, 40_000);
  assert.equal(report.dialoguePlans.passed, 40_000);
  assert.deepEqual(report.failures, []);
  assert.deepEqual(report.dialogueFailures, []);
  assert.ok(report.parserLatency.p95Milliseconds < 1);
});
