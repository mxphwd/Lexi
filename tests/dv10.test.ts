import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { corpusStats, createLexiSession, respond, respondAsync } from "@/lib/lexi/engine";
import { validateDv10BenchmarkArtifact } from "@/modules/benchmark";
import { dv10EngineStats, parseDv10Plan } from "@/modules/dv10";

const localDv9Fetcher = async (source: string) => {
  try {
    const file = new URL(`../public${source}`, import.meta.url);
    return new Response(new Uint8Array(await readFile(file)), { status: 200 });
  } catch {
    return new Response("missing", { status: 404 });
  }
};

test("keeps the human DV9 failure pack frozen and outside runtime data", async () => {
  const validation = await validateDv10BenchmarkArtifact();
  assert.equal(validation.valid, true);
  assert.equal(validation.rows, 2_500);
  assert.equal(validation.hash, "1b45838b516c9f0836575bec701d422e9ab000646ee054c8ca93d35da5b484b6");
});

test("builds typed DV10 plans before clause splitting", () => {
  const arithmetic = parseDv10Plan("I have two apples and buy three more. How many apples do I have?");
  assert.equal(arithmetic?.operation, "reason");
  assert.equal(arithmetic?.relation, "arithmetic_result");
  assert.equal(arithmetic?.quantity, 5);
  assert.deepEqual(arithmetic?.conditions, ["start:2", "increase:3"]);

  const list = parseDv10Plan("List three mammals");
  assert.equal(list?.operation, "list");
  assert.equal(list?.quantity, 3);
  assert.equal(list?.subject?.normalized, "mammals");
});

test("connects language plans, reviewed propositions, graph members, rules, and proof", () => {
  assert.match(respond("How many continents are there?").text, /7 continents/);
  assert.match(respond("Which planet is closest to the Sun?").text, /Mercury/);
  assert.match(respond("How far is the Moon from Earth?").text, /384,400 kilometers/);
  assert.match(respond("What happens when water freezes?").text, /solid ice/);
  assert.match(respond("Why do humans sleep?").text, /form memories/);
  assert.match(respond("What countries border Germany?").text, /Denmark.*Netherlands/);
  assert.match(respond("When was the Internet invented?").text, /ARPANET.*1983/);
  assert.match(respond("What is a CPU?").text, /central processing unit/);
  assert.match(respond("List three planets").text, /Mercury, Venus, and Earth/);
  assert.match(respond("I have two apples and buy three more. How many apples do I have?").text, /2 plus 3 is 5/);

  const session = createLexiSession();
  const answer = session.respond("Tell me something interesting about Saturn");
  assert.equal(answer.trace.source, "semantic-runtime");
  const proof = session.respond("How do you know?");
  assert.equal(proof.trace.interpretedIntent, "dv10:proof");
  assert.match(proof.text, /NASA|Source:/);
  assert.equal(session.snapshot().semanticDialogue.turns.length, 2);
});

test("selects explicit lexical senses from declared context neighborhoods", async () => {
  const options = { fetcher: localDv9Fetcher };
  const river = await respondAsync("What does bank mean in a river?", options);
  const finance = await respondAsync("What does bank mean in finance?", options);
  assert.equal(river.trace.source, "semantic-runtime");
  assert.match(river.text, /sloping land/i);
  assert.equal(finance.trace.source, "semantic-runtime");
  assert.match(finance.text, /financial institution/i);

  const session = createLexiSession();
  await session.respondAsync("What does bank mean in a river?", options);
  const correction = await session.respondAsync("No, I meant finance.", options);
  assert.match(correction.text, /financial institution/i);
});

test("publishes separate surfaces and no unmeasured availability multiplier", () => {
  const stats = dv10EngineStats();
  assert.equal(stats.failureBenchmarkQuestions, 2_500);
  assert.equal(stats.publishedImprovementMultiplier, null);
  assert.deepEqual(corpusStats().dv10, stats);
});
