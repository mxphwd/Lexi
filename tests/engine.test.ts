import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { respond, respondAsync } from "@/lib/lexi/engine";
import { splitIntoClauses } from "@/modules/discourse";
import { analyseSentence, hasUnsupportedWritingSystem } from "@/modules/search";

const wordsetArchive = readFile(
  new URL("../public/lexicon/wordset-dictionary.json.gz", import.meta.url),
);
const localWordsetFetcher = async () =>
  new Response(new Uint8Array(await wordsetArchive), {
    status: 200,
    headers: { "content-type": "application/gzip" },
  });

test("selects stable intents for representative prompts", () => {
  assert.equal(respond("Hello Lexi").trace.interpretedIntent, "greeting");
  assert.equal(respond("How does Lexi work?").trace.interpretedIntent, "mechanism");
  assert.equal(
    respond("How is Lexi different from an LLM?").trace.interpretedIntent,
    "compare-ai",
  );
  assert.equal(
    respond("What does the Context Module do?").trace.interpretedIntent,
    "context-module",
  );
});

test("uses the compiled lexicon for definitions and relations", () => {
  const definition = respond("Define language");
  assert.equal(definition.trace.interpretedIntent, "definition");
  assert.match(definition.text, /^Language means /);

  const synonym = respond("Give me a synonym for context");
  assert.equal(synonym.trace.interpretedIntent, "synonym");
  assert.match(synonym.text, /current Moby-derived runtime graph/);
});

test("falls back instead of inventing unsupported factual material", () => {
  const reply = respond("What is the atomic number of darmstadtium?");
  assert.equal(reply.trace.interpretedIntent, "unknown");
  assert.equal(reply.trace.source, "safe-fallback");
  assert.match(reply.text, /cannot connect that wording/i);
});

test("detects non-Latin writing systems while permitting Latin extensions", () => {
  assert.equal(hasUnsupportedWritingSystem("Hello, Lexi!"), false);
  assert.equal(hasUnsupportedWritingSystem("Café déjà vu"), false);
  assert.equal(hasUnsupportedWritingSystem("Привет, Lexi"), true);
  assert.equal(hasUnsupportedWritingSystem("你好 Lexi"), true);
  assert.equal(hasUnsupportedWritingSystem("안녕 Lexi"), true);
});

test("the engine is deterministic", () => {
  const first = respond("Explain the mechanical process.");
  const second = respond("Explain the mechanical process.");
  assert.deepEqual(second, first);
});

test("uses the expanded basic-conversation corpus", () => {
  assert.equal(respond("My name is Alex.").trace.interpretedIntent, "introduction");
  assert.equal(respond("Could you clarify the main idea?").trace.interpretedIntent, "clarification-request");
  assert.equal(respond("May I ask another question?").trace.interpretedIntent, "permission-request");
  assert.equal(respond("I feel hopeful.").trace.interpretedIntent, "positive-feeling");
  assert.equal(respond("I feel worried.").trace.interpretedIntent, "negative-feeling");
});

test("generalizes basic conversation rules without substring collisions", () => {
  assert.equal(respond("I go by Taylor.").trace.interpretedIntent, "introduction");
  assert.equal(respond("Sorry for the mix-up.").trace.interpretedIntent, "apology");
  assert.equal(respond("Please repeat the answer.").trace.interpretedIntent, "repetition-request");
  assert.equal(respond("I enjoy drawing.").trace.interpretedIntent, "express-like");
  assert.equal(respond("I feel anxious.").trace.interpretedIntent, "negative-feeling");
  assert.equal(respond("Could you explain that more clearly?").trace.interpretedIntent, "clarification-request");
  assert.equal(respond("Is it okay if I ask something else?").trace.interpretedIntent, "permission-request");
  assert.equal(respond("That response was very clear.").trace.interpretedIntent, "compliment");
});

test("uses daily-life contexts without inventing live information", () => {
  assert.equal(respond("Could you tell me the time now?").trace.interpretedIntent, "ask-time");
  assert.equal(respond("What is today's date?").trace.interpretedIntent, "ask-date");
  assert.equal(respond("How much is a phone charger?").trace.interpretedIntent, "price-question");
  assert.equal(respond("How do I get to the station?").trace.interpretedIntent, "direction-request");
  assert.equal(respond("Will it be sunny tomorrow?").trace.interpretedIntent, "weather-question");
  assert.match(respond("Will it be sunny tomorrow?").text, /live (weather|source)|weather service/i);
  assert.equal(respond("My day begins with breakfast.").trace.interpretedIntent, "morning-routine");
  assert.equal(respond("I need to organize a weekend vacation.").trace.interpretedIntent, "travel-planning");
  assert.equal(respond("I have to wash my clothes today.").trace.interpretedIntent, "household-chore");
});

test("handles foundational phrases before the corpus modules", () => {
  const hello = respond("Hello!");
  assert.equal(hello.text, "Hello. I’m Lexi. What would you like to talk about?");
  assert.equal(hello.trace.interpretedIntent, "greeting");
  assert.equal(hello.trace.source, "core-phrase");
  assert.equal(hello.trace.selectedStructure, "core:greeting");

  const userName = respond("What's my name?");
  assert.equal(userName.trace.interpretedIntent, "user-name");
  assert.equal(userName.trace.source, "core-phrase");
  assert.match(userName.text, /don’t know your name/i);

  const age = respond("How old are you?");
  assert.equal(age.trace.interpretedIntent, "model-age");
  assert.equal(age.trace.source, "core-phrase");
  assert.match(age.text, /Lexi Language 1\.0 Pre-build 260721-0A/);

  assert.equal(respond("What’s your name?").trace.interpretedIntent, "identity");
  assert.equal(respond("HOW ARE YOU?").trace.interpretedIntent, "wellbeing");
  assert.equal(respond("Thank you, Lexi.").trace.interpretedIntent, "thanks");
  assert.equal(respond("Goodbye.").trace.interpretedIntent, "farewell");
});

test("does not let core phrases capture longer contextual messages", () => {
  assert.notEqual(respond("Hello, can you explain the Context Module?").trace.source, "core-phrase");
  assert.equal(respond("My name is Alex.").trace.interpretedIntent, "introduction");
  assert.equal(respond("How does Lexi work?").trace.interpretedIntent, "mechanism");
});

test("understands polite imperatives, contractions, and grammatical roles", () => {
  const question = analyseSentence("How does Lexi work?");
  assert.equal(question.mode, "interrogative");
  assert.equal(question.questionWord, "how");
  assert.equal(question.auxiliary, "does");
  assert.equal(question.subject, "lexi");
  assert.equal(question.predicate, "work");

  const imperative = analyseSentence("Please explain the Context Module.");
  assert.equal(imperative.mode, "imperative");
  assert.equal(imperative.subject, "you");
  assert.equal(imperative.predicate, "explain");
  assert.equal(imperative.object, "the context module");

  assert.equal(analyseSentence("What’s Lexi?").normalized, "what is lexi");

  const politeContext = respond("Can you explain the Context Module?");
  assert.equal(politeContext.trace.interpretedIntent, "context-module");
  assert.notEqual(politeContext.text, "{response}");
  assert.match(politeContext.text, /Context Module/);

  const imperativeContext = respond("Please explain the Context Module.");
  assert.equal(imperativeContext.trace.interpretedIntent, "context-module");
  assert.notEqual(imperativeContext.text, "{response}");
});

test("segments explicit requests and inherits recognized connection frames", () => {
  assert.deepEqual(
    splitIntoClauses("Hello! Explain the Context Module and then explain the Search Module."),
    ["Hello", "Explain the Context Module", "explain the Search Module"],
  );
  assert.deepEqual(splitIntoClauses("Explain the dictionary and thesaurus."), [
    "Explain the dictionary",
    "Explain thesaurus",
  ]);
  assert.deepEqual(splitIntoClauses("What is math and science?"), [
    "What is math",
    "What is science",
  ]);
  assert.deepEqual(splitIntoClauses("What’s your name and your age?"), [
    "What’s your name",
    "What’s your age",
  ]);
  assert.deepEqual(splitIntoClauses("Bread and butter are foods."), [
    "Bread and butter are foods",
  ]);
});

test("combines multiple bounded answers with reviewed structures", () => {
  const opening = respond("Hello! What’s your name?");
  assert.equal(opening.trace.source, "combined-response");
  assert.equal(opening.trace.interpretedIntent, "greeting + identity");
  assert.equal(opening.trace.clauseCount, 2);
  assert.deepEqual(opening.trace.clauseIntents, ["greeting", "identity"]);
  assert.equal(opening.trace.selectedStructure, "discourse-opening-answer");
  assert.match(opening.text, /^Hello\./);
  assert.match(opening.text, /I’m Lexi/);

  const twoPart = respond("What’s your name and how old are you?");
  assert.equal(twoPart.trace.source, "combined-response");
  assert.equal(twoPart.trace.selectedStructure, "discourse-multipart");
  assert.match(twoPart.text, /^First:/);
  assert.match(twoPart.text, /Second:/);
  assert.match(twoPart.text, /260721-0A/);

  const modules = respond(
    "Explain the Context Module and then explain the Search Module.",
  );
  assert.equal(modules.trace.interpretedIntent, "context-module + search-module");
  assert.equal(modules.trace.source, "combined-response");
});

test("answers arbitrary definition requests from the complete embedded Wordset archive", async () => {
  const dictionaryOptions = { fetcher: localWordsetFetcher };
  const math = await respondAsync("What is Math?", dictionaryOptions);

  assert.equal(math.trace.interpretedIntent, "definition");
  assert.equal(math.trace.source, "full-dictionary");
  assert.equal(math.trace.selectedStructure, "definition-full-wordset");
  assert.deepEqual(math.trace.matchedExampleIds, ["wordset:47fb0bb180"]);
  assert.match(math.text, /^Math means a science/);

  const combined = await respondAsync("What is math and science?", dictionaryOptions);
  assert.equal(combined.trace.source, "combined-response");
  assert.equal(combined.trace.clauseCount, 2);
  assert.deepEqual(combined.trace.clauseIntents, ["definition", "definition"]);
  assert.match(combined.text, /^First: Math means/);
  assert.match(combined.text, /Second: Science means/);
});

test("combines inherited basic-question frames without dictionary collisions", async () => {
  const reply = await respondAsync("What’s your name and your age?", {
    fetcher: localWordsetFetcher,
  });

  assert.equal(reply.trace.source, "combined-response");
  assert.deepEqual(reply.trace.clauseIntents, ["identity", "model-age"]);
  assert.match(reply.text, /I’m Lexi/);
  assert.match(reply.text, /260721-0A/);
});
