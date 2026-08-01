import assert from "node:assert/strict";
import test from "node:test";
import { createLexiSession, respond } from "@/lib/lexi/engine";
import { runDv8BlindBenchmark } from "@/modules/benchmark";
import {
  dv8EngineStats,
  dv8LexicalIndex,
  parseQueryPlan,
} from "@/modules/dv8";

test("compiles explicit word senses and typed query plans", () => {
  const stats = dv8EngineStats();
  assert.ok(stats.lexicon.aliases > 1_600);
  assert.ok(stats.lexicon.senses >= stats.lexicon.aliases);
  assert.ok(stats.lexicon.ambiguousAliases >= 1);
  assert.ok(stats.facts.facts > 3_100);
  assert.ok(stats.facts.entityEdges > 250);

  const inverse = parseQueryPlan(
    "Which country has Paris as its capital?",
    dv8LexicalIndex,
  );
  assert.equal(inverse.operation, "select");
  assert.equal(inverse.patterns[0].inverse, true);
  assert.equal(inverse.patterns[0].predicate, "capital");

  const joined = parseQueryPlan(
    "Which cities are capitals of countries in Asia?",
    dv8LexicalIndex,
  );
  assert.equal(joined.operation, "select");
  assert.equal(joined.patterns.length, 2);
  assert.equal(joined.patterns[0].object.kind, "entity");

  const conditional = parseQueryPlan(
    "Can a bee produce honey if it is a honey bee species?",
    dv8LexicalIndex,
  );
  assert.equal(conditional.operation, "ask");
  assert.equal(conditional.condition, "it is a honey bee species");
});

test("executes inverse joins, conditions, negatives, comparisons, and aggregates", () => {
  assert.match(respond("Name the person who came up with the telephone.").text, /Alexander Graham Bell/);
  assert.match(respond("What did Alexander Graham Bell invent?").text, /telephone/i);
  assert.match(respond("Which country has Paris as its capital?").text, /France/);
  assert.match(respond("Which is larger, Earth or Mars?").text, /Earth has the larger value/);
  assert.match(respond("Can a bee produce honey if it is a penguin?").text, /^No\./);
  assert.match(respond("Can a bee produce honey if it is a honey bee species?").text, /^Yes\./);
  assert.equal(respond("Can a penguin not fly?").text, "Yes. Penguin cannot fly.");
  assert.equal(respond("Does a spider have 10 legs?").text, "No. Spider does not have 10 legs.");
  assert.match(respond("How many countries are in Asia?").text, /recorded count is \d+/);
});

test("uses calibrated subject-compatible abstention instead of unrelated fallback", () => {
  const unsupported = respond("What is the favorite song of a spider?");
  assert.equal(unsupported.trace.source, "language-engine");
  assert.equal(unsupported.trace.interpretedIntent, "typed-clarification");
  assert.match(unsupported.text, /does not map to a supported typed relation/);
  assert.doesNotMatch(unsupported.text, /Search Module|favorite song is/i);

  const historical = respond("What was the capital of Japan in 1900?");
  assert.equal(historical.trace.source, "language-engine");
  assert.match(historical.text, /do not have a subject-compatible recorded capital fact/);
  assert.doesNotMatch(historical.text, /Tokyo is the capital/);
});

test("tracks answer propositions, active subjects, goals, and proof follow-ups", () => {
  const session = createLexiSession();
  session.respond("What is a spider?");
  assert.match(session.respond("Where does it live?").text, /terrestrial habitat/);
  assert.match(session.respond("Why?").text, /^Because /);
  assert.equal(session.respond("What are we talking about?").text, "The active subject is spider.");
  const snapshot = session.snapshot();
  assert.ok(snapshot.propositions.length >= 4);
  assert.ok(snapshot.propositions.some((turn) => turn.goal === "inform"));
});

test("passes the DV8 blind benchmark and reports six separate measurements", () => {
  const report = runDv8BlindBenchmark();
  assert.equal(report.total, 4_124);
  assert.equal(report.passed, report.total);
  assert.deepEqual(report.failures, []);
  assert.equal(report.metrics.knowledge.rate, 1);
  assert.equal(report.metrics.languageRobustness.rate, 1);
  assert.equal(report.metrics.reasoning.rate, 1);
  assert.equal(report.metrics.dialogue.rate, 1);
  assert.equal(report.metrics.precision.rate, 1);
  assert.ok(report.metrics.latency.p95Milliseconds < 10);
  assert.ok((report.measuredAvailabilityGain ?? 0) > 1.04);
  assert.ok((report.measuredAvailabilityGain ?? Infinity) < 1.06);
});
