import assert from "node:assert/strict";
import test from "node:test";
import { runDv7CoverageBenchmark } from "@/modules/benchmark";
import { dv7AvailabilityStats } from "@/modules/dv7";
import { createLexiSession, respond } from "@/lib/lexi/engine";
import { lexiKnowledgeGraph } from "@/modules/knowledge-graph";
import {
  parseSemanticQuery,
  semanticComparisonQuestionTemplates,
} from "@/modules/semantic";

test("measures DV7 from actual propositions, supported forms, and shared-property pairs", () => {
  const stats = dv7AvailabilityStats();
  assert.equal(stats.entities, 590);
  assert.equal(stats.aliases, 1_683);
  assert.equal(stats.propositions, 3_132);
  assert.equal(stats.benchmarkablePropositions, 3_132);
  assert.equal(stats.predicates, 42);
  assert.equal(stats.openQuestionFrames, 12);
  assert.equal(stats.booleanQuestionFrames, 8);
  assert.equal(stats.comparisonQuestionFrames, 60);
  assert.equal(stats.answerStyles, 10);
  assert.equal(stats.comparableSubjectPairs, 409_902);
  assert.equal(stats.semanticConstructions, 246_567_600);
  assert.ok(stats.multipleOverDv6 > 492.79);
  assert.ok(stats.multipleOverDv6 < 492.8);
});

test("parses typed subjects, relations, objects, quantities, time, and conditions", () => {
  const property = parseSemanticQuery(
    "Could you tell me the temperature of the Sun in 2026?",
    lexiKnowledgeGraph,
  );
  assert.equal(property.subjectId, "space-sun");
  assert.equal(property.relation, "temperature");
  assert.equal(property.kind, "open");
  assert.equal(property.modifiers.time, "in 2026");
  assert.equal(property.modifiers.quantity, 2026);

  const ability = parseSemanticQuery(
    "Can a penguin fly?",
    lexiKnowledgeGraph,
  );
  assert.equal(ability.subjectId, "animal-penguin");
  assert.equal(ability.relation, "ability");
  assert.equal(ability.kind, "boolean");
  assert.equal(ability.ability, "fly");

  const conditional = parseSemanticQuery(
    "Can a bee produce honey if it is a honey bee species?",
    lexiKnowledgeGraph,
  );
  assert.equal(conditional.subjectId, "animal-bee");
  assert.equal(conditional.kind, "boolean");
  assert.equal(conditional.modifiers.condition, "it is a honey bee species");
});

test("joins direct, inherited, transitive, comparison, and derived-location facts", () => {
  const inherited = respond("Is a penguin an animal?");
  assert.equal(inherited.trace.source, "language-engine");
  assert.match(inherited.text, /^Yes\./);
  assert.ok(inherited.trace.proof?.some((step) => /transitively/i.test(step)));

  const override = respond("Can a penguin fly?");
  assert.equal(override.text, "No. Penguin cannot fly.");

  const comparison = respond("Compare cats and birds by leg count.");
  assert.match(comparison.text, /Cat has 4/);
  assert.match(comparison.text, /bird has 2/i);

  const derived = respond("What continent is Tokyo in?");
  assert.equal(derived.trace.source, "language-engine");
  assert.match(derived.text, /Asia/);
  assert.ok(derived.trace.matchedExampleIds.some((id) => id.startsWith("fact:")));
});

test("keeps all sixty measured semantic comparison forms executable", () => {
  assert.equal(semanticComparisonQuestionTemplates.length, 60);
  for (const template of semanticComparisonQuestionTemplates) {
    const reply = respond(template.render("cat", "dog", "diet"));
    assert.ok(
      reply.trace.source === "language-engine" || reply.trace.source === "knowledge-graph",
      template.id,
    );
    assert.match(reply.text, /meat/i, template.id);
  }
});

test("stores personal facts and resolves references only inside an explicit session", () => {
  const session = createLexiSession();

  assert.match(session.respond("My name is Mina.").text, /Mina/);
  assert.equal(session.respond("What is my name?").text, "Your name is Mina.");

  assert.match(session.respond("What is a spider?").text, /arachnid/);
  assert.match(session.respond("Where does it live?").text, /terrestrial/);
  assert.equal(session.respond("How many legs does it have?").text, "Spider has 8 legs.");

  const snapshot = session.snapshot();
  assert.equal(snapshot.userName, "Mina");
  assert.deepEqual(snapshot.activeSubjectIds, ["animal-spider"]);

  const stateless = respond("What is my name?");
  assert.match(stateless.text, /don’t know your name/i);
});

test("passes the independent DV7 coverage benchmark without hiding failure classes", () => {
  const report = runDv7CoverageBenchmark();
  assert.equal(report.total, 3_211);
  assert.equal(report.passed, report.total);
  assert.equal(report.failed, 0);
  assert.equal(report.passRate, 1);
  assert.deepEqual(report.failureReasons, {});
  assert.deepEqual(report.failures, []);
});

test("still refuses a factual relation that has no supporting proposition", () => {
  const reply = respond("What is the favorite song of a spider?");
  assert.notEqual(reply.trace.source, "knowledge-graph");
  assert.doesNotMatch(reply.text, /spider's favorite song is/i);
});
