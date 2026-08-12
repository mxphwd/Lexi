import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { corpusStats, respond, respondAsync } from "@/lib/lexi/engine";
import { splitIntoClauses } from "@/modules/discourse";
import { extendedPackStats } from "@/modules/extended-pack";
import { dv6ConversationPatternCount } from "@/modules/extended-pack/dv6-conversation";
import { dv6LinguisticFeatureCount } from "@/modules/extended-pack/dv6-linguistic-features";
import { dv6QuestionFrameCount } from "@/modules/extended-pack/dv6-question-frames";
import { deterministicReasoningFeatureCount } from "@/modules/extended-pack/reasoning";
import {
  comparisonFrames,
  singleSubjectFrames,
} from "@/modules/extended-pack/question-frames";
import { knowledgeTopics } from "@/modules/extended-pack/topics";
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
    "comparison",
  );
  assert.equal(
    respond("What does the Context Module do?").trace.interpretedIntent,
    "purpose",
  );
});

test("uses the DV7 graph before lexical and corpus fallbacks", () => {
  const definition = respond("Define language");
  assert.equal(definition.trace.interpretedIntent, "definition");
  assert.equal(definition.trace.source, "language-engine");
  assert.match(definition.text, /^Language is /);

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
  assert.match(age.text, /Lexi Language 1\.0 Pre-build 260812-DV11/);

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
  assert.equal(politeContext.trace.interpretedIntent, "definition");
  assert.equal(politeContext.trace.source, "language-engine");
  assert.notEqual(politeContext.text, "{response}");
  assert.match(politeContext.text, /Context Module/);

  const imperativeContext = respond("Please explain the Context Module.");
  assert.equal(imperativeContext.trace.interpretedIntent, "definition");
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
  assert.deepEqual(
    splitIntoClauses("What are math, science, and language?"),
    ["What are math", "What are science", "What are language"],
  );
  assert.deepEqual(splitIntoClauses("What is math and why is it important?"), [
    "What is math",
    "Why is math important",
  ]);
  assert.deepEqual(splitIntoClauses("Explain gravity and give me an example."), [
    "Explain gravity",
    "Give me an example of gravity",
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
  assert.match(twoPart.text, /260812-DV11/);

  const modules = respond(
    "Explain the Context Module and then explain the Search Module.",
  );
  assert.equal(modules.trace.interpretedIntent, "definition");
  assert.deepEqual(modules.trace.clauseIntents, ["definition", "definition"]);
  assert.equal(modules.trace.source, "combined-response");
});

test("answers broad natural questions directly from authored semantic fields", () => {
  const purpose = respond("What is mathematics used for?");
  assert.equal(purpose.trace.source, "language-engine");
  assert.equal(purpose.trace.interpretedIntent, "purpose");
  assert.match(purpose.text, /describe patterns/);

  const mechanism = respond("Could you explain how photosynthesis works?");
  assert.equal(mechanism.trace.source, "language-engine");
  assert.equal(mechanism.trace.interpretedIntent, "mechanism");
  assert.match(mechanism.text, /light-driven reactions/);

  const importance = respond("Why does grammar matter?");
  assert.equal(importance.trace.interpretedIntent, "importance");
  assert.match(importance.text, /new expressions/);

  const example = respond("Give me an example of an algorithm.");
  assert.equal(example.trace.interpretedIntent, "example");
  assert.match(example.text, /sorting names/);

  const components = respond("What are the parts of a cell?");
  assert.equal(components.trace.interpretedIntent, "components");
  assert.match(components.text, /cell membrane/);

  const related = respond("What concepts are related to climate?");
  assert.equal(related.trace.interpretedIntent, "related");
  assert.match(related.text, /weather/);
});

test("compares two known subjects without searching example sentences", () => {
  const comparison = respond("What is the difference between weather and climate?");
  assert.ok(
    comparison.trace.source === "language-engine" ||
      comparison.trace.source === "knowledge-graph",
  );
  assert.equal(comparison.trace.interpretedIntent, "comparison");
  assert.equal(comparison.trace.matchedExampleIds.length, 2);
  assert.match(comparison.text, /Weather has the recorded definition/);
  assert.match(comparison.text, /while climate has/);
});

test("carries a known subject into coordinated semantic follow-up questions", () => {
  const reply = respond("What is math and why is it important?");
  assert.equal(reply.trace.source, "combined-response");
  assert.deepEqual(reply.trace.clauseIntents, ["definition", "importance"]);
  assert.match(reply.text, /^First: Mathematics is/);
  assert.match(reply.text, /Second: Mathematics matters because/);

  const example = respond("Explain gravity and give me an example.");
  assert.deepEqual(example.trace.clauseIntents, ["definition", "example"]);
  assert.match(example.text, /Earth keeping the Moon in orbit/);
});

test("resolves singular and paired references only from explicit local antecedents", () => {
  const singular = respond(
    "What is math? How exactly does it work? Why should I care about it?",
  );
  assert.deepEqual(singular.trace.clauseIntents, [
    "definition",
    "mechanism",
    "importance",
  ]);
  assert.match(singular.text, /definitions and assumptions/);
  assert.match(singular.text, /precise language for science/);

  const pair = respond(
    "What are math and science, and how are they related?",
  );
  assert.deepEqual(pair.trace.clauseIntents, [
    "definition",
    "definition",
    "similarity",
  ]);
  assert.match(pair.text, /directly related concepts/);

  const pairedExamples = respond(
    "Compare math and science. Give me an example of each.",
  );
  assert.deepEqual(pairedExamples.trace.clauseIntents, [
    "comparison",
    "example",
    "example",
  ]);

  const switched = respond(
    "What is math? What is gravity? How does it work?",
  );
  assert.deepEqual(switched.trace.clauseIntents, [
    "definition",
    "definition",
    "mechanism",
  ]);
  assert.match(switched.text, /mass-energy shapes spacetime/);

  const unresolved = respond("How does it work?");
  assert.equal(unresolved.trace.source, "safe-fallback");
  assert.equal(unresolved.trace.interpretedIntent, "reference-clarification");
  assert.match(unresolved.text, /exactly one supported subject or pair/);

  const ambiguousGroup = respond(
    "What are math, science, and language, and how are they related?",
  );
  assert.deepEqual(ambiguousGroup.trace.clauseIntents, [
    "definition",
    "definition",
    "definition",
    "typed-clarification",
  ]);
});

test("understands indirect, polite, styled, and discourse-marked questions", () => {
  const simple = respond(
    "Well, could you explain math in simple terms, please?",
  );
  assert.equal(simple.trace.source, "language-engine");
  assert.equal(simple.trace.interpretedIntent, "definition");
  assert.match(simple.text, /^In simple terms,/);
  assert.match(simple.trace.selectedStructure, /:simple$/);

  const exampled = respond(
    "I was wondering if you could tell me about gravity with an example.",
  );
  assert.equal(exampled.trace.interpretedIntent, "definition");
  assert.match(exampled.text, /example is Earth keeping the Moon in orbit/i);
  assert.match(exampled.trace.selectedStructure, /:exampled$/);

  const detailed = respond("Would you mind explaining climate in detail?");
  assert.equal(detailed.trace.interpretedIntent, "definition");
  assert.match(detailed.trace.selectedStructure, /:detailed$/);
  assert.match(detailed.text, /Climate is used to/);

  const wrappedGreeting = respond("Well, hello, please.");
  assert.equal(wrappedGreeting.trace.source, "core-phrase");
  assert.equal(wrappedGreeting.trace.interpretedIntent, "greeting");
});

test("supports summaries, learning paths, and relationship-aware comparisons", () => {
  const summary = respond("Give me the big picture of an algorithm.");
  assert.equal(summary.trace.interpretedIntent, "summary");
  assert.match(summary.text, /Its main purpose/);
  assert.match(summary.text, /It matters because/);

  const learning = respond("Where should I start with biology?");
  assert.equal(learning.trace.interpretedIntent, "learning");
  assert.match(learning.text, /^To learn biology/);
  assert.match(learning.text, /cell biology/);

  const similarity = respond("What do weather and climate have in common?");
  assert.equal(similarity.trace.interpretedIntent, "similarity");
  assert.match(similarity.text, /directly related concepts/);

  const unsupportedRelation = respond(
    "What do encryption and nutrition have in common?",
  );
  assert.equal(unsupportedRelation.trace.interpretedIntent, "similarity");
  assert.match(unsupportedRelation.text, /no direct relationship/);
});

test("uses complete embedded Wordset only for subjects outside the Extended Pack", async () => {
  const dictionaryOptions = { fetcher: localWordsetFetcher };
  const math = await respondAsync("What is Math?", dictionaryOptions);

  assert.equal(math.trace.interpretedIntent, "definition");
  assert.equal(math.trace.source, "language-engine");
  assert.match(math.text, /^Mathematics is/);

  const zeppelin = await respondAsync("What is a zeppelin?", dictionaryOptions);
  assert.equal(zeppelin.trace.source, "full-dictionary");
  assert.deepEqual(zeppelin.trace.matchedExampleIds, ["wordset:9c35e4a1aa"]);
  assert.match(zeppelin.text, /^Zeppelin means a large rigid dirigible/);

  const combined = await respondAsync("What is math and science?", dictionaryOptions);
  assert.equal(combined.trace.source, "combined-response");
  assert.equal(combined.trace.clauseCount, 2);
  assert.deepEqual(combined.trace.clauseIntents, ["definition", "definition"]);
  assert.match(combined.text, /^First: Mathematics is/);
  assert.match(combined.text, /Second: Science is/);
});

test("combines inherited basic-question frames without dictionary collisions", async () => {
  const reply = await respondAsync("What’s your name and your age?", {
    fetcher: localWordsetFetcher,
  });

  assert.equal(reply.trace.source, "combined-response");
  assert.deepEqual(reply.trace.clauseIntents, ["identity", "model-age"]);
  assert.match(reply.text, /I’m Lexi/);
  assert.match(reply.text, /260812-DV11/);
});

test("handles extended conversational phrases without approximate corpus matching", () => {
  const certainty = respond("Are you sure?");
  assert.equal(certainty.trace.source, "extended-pack");
  assert.equal(certainty.trace.interpretedIntent, "certainty-check");
  assert.match(certainty.text, /confidence applies to the match/);

  const privacy = respond("Do you remember me?");
  assert.equal(privacy.trace.source, "extended-pack");
  assert.equal(privacy.trace.interpretedIntent, "privacy-boundary");
  assert.match(privacy.text, /do not use personal memory/);

  const decision = respond("Help me decide.");
  assert.equal(decision.trace.source, "extended-pack");
  assert.equal(decision.trace.interpretedIntent, "decision-support");
});

test("keeps every authored DV6 topic reachable across semantic question focuses", () => {
  const ids = new Set<string>();

  for (const topic of knowledgeTopics) {
    assert.equal(ids.has(topic.id), false, `duplicate topic id: ${topic.id}`);
    ids.add(topic.id);

    const prompts = [
      `What is ${topic.term}?`,
      `What is ${topic.term} used for?`,
      `How does ${topic.term} work?`,
      `Why is ${topic.term} important?`,
      `Give me an example of ${topic.term}.`,
      `What concepts are related to ${topic.term}?`,
      `Summarize ${topic.term}.`,
      `How can I learn ${topic.term}?`,
    ];
    if (topic.components?.length) {
      prompts.push(`What are the parts of ${topic.term}?`);
    }

    for (const prompt of prompts) {
      const reply = respond(prompt);
      assert.ok(
        reply.trace.source === "knowledge-graph" ||
          reply.trace.source === "language-engine" ||
          reply.trace.source === "extended-pack",
        `${topic.id}: ${prompt} routed to ${reply.trace.source}`,
      );
      if (reply.trace.source === "knowledge-graph" || reply.trace.source === "language-engine") {
        assert.ok(
          reply.trace.matchedExampleIds.some((id) =>
            id.startsWith("proposition:") || id.startsWith("fact:")
          ),
          `${topic.id}: missing proposition for ${prompt}`,
        );
      } else {
        assert.ok(
          reply.trace.matchedExampleIds.includes(`knowledge:${topic.id}`),
          `${topic.id}: missing compatibility record for ${prompt}`,
        );
      }
    }
  }

  const stats = extendedPackStats();
  assert.equal(stats.topics, 222);
  assert.equal(stats.aliases, 1_000);
  assert.equal(stats.questionFrames, 500);
  assert.equal(stats.conversationPatterns, 247);
  assert.equal(stats.reasoningFeatures, 100);
  assert.equal(stats.semanticRoutingFeatures, 24);
  assert.equal(stats.minimumQuestionConstructions, 500_347);

  const previousAvailability = 71_243;
  const availabilityMultiplier =
    stats.minimumQuestionConstructions / previousAvailability;
  assert.ok(availabilityMultiplier >= 7);
  assert.ok(availabilityMultiplier < 7.1);

  const engineStats = corpusStats();
  assert.equal(engineStats.linguisticFeatures, 1_147);
  assert.equal(engineStats.linguisticFeatures - 347, 800);
});

test("keeps the DV6 grammatical frame registry unique and within the release target", () => {
  const frames = [...singleSubjectFrames, ...comparisonFrames];
  const frameIds = new Set(frames.map((frame) => frame.id));

  assert.equal(frames.length, 500);
  assert.equal(frameIds.size, frames.length);
  assert.ok(frames.every((frame) => frame.pattern.source.startsWith("^")));
  assert.ok(frames.every((frame) => frame.pattern.source.endsWith("$")));

  assert.equal(dv6QuestionFrameCount, 336);
  assert.equal(dv6LinguisticFeatureCount, 100);
  assert.equal(dv6ConversationPatternCount, 180);
  assert.equal(deterministicReasoningFeatureCount, 100);

  const constructions = extendedPackStats().minimumQuestionConstructions;
  assert.ok(constructions >= 500_000);
  assert.ok(constructions <= 700_000);
  const multiplier = constructions / 71_243;
  assert.ok(multiplier >= 7);
  assert.ok(multiplier < 7.1);
});

test("answers DV6 field-specific and technical questions through authored records", () => {
  const llm = respond("What is a large language model?");
  assert.equal(llm.trace.source, "language-engine");
  assert.match(llm.text, /many learned parameters/i);

  const attention = respond(
    "To be clear, could you outline attention mechanisms at its core in technical terms?",
  );
  assert.equal(attention.trace.source, "extended-pack");
  assert.equal(attention.trace.selectedStructure, "extended-knowledge:definition:technical");
  assert.match(attention.text, /queries are compared with keys/i);
  assert.ok(attention.trace.matchedTerms.includes("feature:semantic-at-core"));

  const practical = respond("Explain cloud computing with a practical use.");
  assert.equal(practical.trace.selectedStructure, "dv8-language-engine:lookup:definition:practical");
  assert.match(practical.text, /rented virtual servers/i);

  const medicine = respond("How does a vaccine work?");
  assert.equal(medicine.trace.source, "language-engine");
  assert.match(medicine.text, /adaptive immune response/i);
});

test("performs bounded DV6 arithmetic, sequence, text, and logical reasoning", () => {
  const addition = respond("What is 27 plus 15?");
  assert.equal(addition.trace.interpretedIntent, "reasoning:addition");
  assert.equal(addition.text, "27 plus 15 is 42.");

  assert.equal(
    respond("What is 20 percent of 80?").text,
    "20 percent of 80 is 16.",
  );
  assert.equal(
    respond("What is the average of 2, 4, 6?").text,
    "The arithmetic mean of 2, 4, 6 is 4.",
  );
  assert.equal(
    respond("What comes next in 2, 4, 6, 8?").text,
    "The constant difference is 2, so the next term is 10.",
  );
  assert.match(
    respond("What comes next in 2, 4, 9?").text,
    /will not guess/i,
  );
  assert.equal(
    respond("How many words are in mechanical language model?").text,
    '"mechanical language model" contains 3 words.',
  );

  const logic = respond(
    "If all cats are mammals and Luna is a cat, is Luna a mammal?",
  );
  assert.equal(logic.trace.interpretedIntent, "reasoning:logic");
  assert.match(logic.text, /^Yes\./);
  assert.match(logic.text, /stated premises/);
});

test("covers common DV6 conversation repair, emotion, planning, and play scenarios", () => {
  const cases = [
    ["I am back.", "greeting"],
    ["I feel overwhelmed.", "negative-feeling"],
    ["Rephrase that.", "clarification-request"],
    ["Let's change the topic.", "conversation-control"],
    ["Help me plan my day.", "task-planning"],
    ["I keep procrastinating.", "task-planning"],
    ["Help me troubleshoot.", "problem-solving"],
    ["Tell me a fun fact.", "conversation-request"],
    ["Tell me a riddle.", "humor"],
    ["Be honest with me.", "certainty-check"],
  ] as const;

  for (const [prompt, intent] of cases) {
    const reply = respond(prompt);
    assert.equal(reply.trace.source, "extended-pack", prompt);
    assert.equal(reply.trace.interpretedIntent, intent, prompt);
  }
});

test("resolves DV6 singular and paired follow-ups without guessing antecedents", () => {
  const singular = respond(
    "What is a neural network? What are its main elements? Explain it technically.",
  );
  assert.deepEqual(singular.trace.clauseIntents, [
    "definition",
    "components",
    "definition",
  ]);
  assert.match(singular.text, /input representation/i);

  const paired = respond(
    "What are correlation and causation? What is their key difference?",
  );
  assert.deepEqual(paired.trace.clauseIntents, [
    "definition",
    "definition",
    "comparison",
  ]);
  assert.match(paired.text, /while causation has/i);
});
