import assert from "node:assert/strict";
import test from "node:test";
import { respond } from "@/lib/lexi/engine";
import { hasUnsupportedWritingSystem } from "@/modules/search";

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
  assert.match(age.text, /Lexi Language 1\.0 Pre-build 260720-1A/);

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
