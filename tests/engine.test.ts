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
  const reply = respond("What is the weather in Seoul?");
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
