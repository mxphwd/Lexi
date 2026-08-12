import { resolve } from "node:path";
import { loadDv11Jsonl, gradeDv11Response, summarizeDv11Rows } from "../modules/benchmark/dv11.ts";
import { createLexiSession, respond } from "../lib/lexi/engine.ts";
import { parseDv11Query } from "../modules/dv11/parser.ts";
import { performance } from "node:perf_hooks";

const evaluationRoot = resolve("data/dv11/evaluation");
const fixtureRows = await loadDv11Jsonl(resolve(evaluationRoot, "ordinary-questions.jsonl"));
const realRows = await loadDv11Jsonl(resolve(evaluationRoot, "real-user-failures.jsonl"));

function execute(row) {
  const started = performance.now();
  if (row.category === "dialogue" && /\.\s+/.test(row.prompt)) {
    const session = createLexiSession();
    const parts = row.prompt.split(/(?<=[.!?])\s+/).filter(Boolean);
    let reply;
    for (const part of parts) reply = session.respond(part);
    return { reply, durationMilliseconds: performance.now() - started };
  }
  return { reply: respond(row.prompt), durationMilliseconds: performance.now() - started };
}

const measured = fixtureRows.map((row) => {
  const { reply, durationMilliseconds } = execute(row);
  const grade = gradeDv11Response(row, reply.text, reply.trace.executionStatus);
  return { ...row, observedOutput: reply.text, outcome: grade.outcome, adjudication: { required: grade.requiresHumanAdjudication }, durationMilliseconds, confidence: reply.trace.confidence, status: reply.trace.executionStatus };
});
const componentNames = ["intent", "requestedProperty", "subject", "object", "relation", "wordSense", "conditions", "quantifiers", "negation", "temporalScope", "answerShape", "clauseBoundaries"];
const componentScores = Object.fromEntries(componentNames.map((name) => [name, { tested: 0, passed: 0, rate: null }]));
for (const row of measured) {
  const expected = row.expectedComponents;
  if (!expected) continue;
  const plan = parseDv11Query(row.prompt).plan;
  const clause = plan.clauses[0];
  const actual = {
    intent: clause?.speechAct,
    requestedProperty: clause?.requestedProperty,
    subject: clause?.patterns[0]?.subject.kind === "entity" ? clause.patterns[0].subject.entityId : clause?.patterns[0]?.subject.kind,
    object: clause?.patterns[0]?.object.kind === "entity" ? clause.patterns[0].object.entityId : clause?.patterns[0]?.object.kind,
    relation: clause?.patterns[0]?.relation,
    wordSense: clause?.mentions.find((mention) => mention.selectedSenseId)?.selectedSenseId,
    conditions: clause?.conditions.length ?? 0,
    quantifiers: clause?.quantifiers.length ?? 0,
    negation: clause?.negated ?? false,
    temporalScope: clause?.temporal.map((item) => item.kind),
    answerShape: clause?.answerShape,
    clauseBoundaries: plan.clauses.map((item) => item.source.text),
  };
  for (const [name, wanted] of Object.entries(expected)) {
    const metric = componentScores[name];
    if (!metric) continue;
    metric.tested += 1;
    if (JSON.stringify(actual[name]) === JSON.stringify(wanted)) metric.passed += 1;
  }
}
for (const metric of Object.values(componentScores)) metric.rate = metric.tested ? metric.passed / metric.tested : null;

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0;
}

const outcomeCount = (outcome) => measured.filter((row) => row.outcome === outcome).length;
const correctFor = (categories) => {
  const rows = measured.filter((row) => categories.includes(row.category) && row.answerable);
  return { samples: rows.length, correct: rows.filter((row) => row.outcome === "correct-answer").length, rate: rows.length ? rows.filter((row) => row.outcome === "correct-answer").length / rows.length : 0 };
};
const report = {
  release: "DV11",
  releaseGate: {
    realFailuresRequiredMinimum: 2_000,
    realFailuresRequiredMaximum: 5_000,
    realFailuresAvailable: realRows.length,
    met: realRows.length >= 2_000 && realRows.length <= 5_000,
    reason: realRows.length >= 2_000 ? undefined : "Independent actual Lexi failure collection is not yet large enough; schema fixtures and proxy data do not count.",
  },
  fixture: summarizeDv11Rows(measured),
  results: measured.map(({ id, category, answerable, observedOutput, outcome, adjudication, durationMilliseconds, confidence, status }) => ({ id, category, answerable, observedOutput, outcome, adjudication, durationMilliseconds, confidence, status })),
  metrics: {
    knowledge: correctFor(["everyday-fact", "definition", "explanation", "procedure"]),
    language: componentScores,
    reasoning: correctFor(["comparison", "arithmetic", "logic"]),
    dialogue: correctFor(["dialogue", "reference", "multi-part"]),
    precision: { samples: measured.length, incorrectAnswers: outcomeCount("incorrect-answer"), confidentlyIncorrect: measured.filter((row) => row.outcome === "incorrect-answer" && row.confidence >= 0.8).length, rate: measured.length ? 1 - outcomeCount("incorrect-answer") / measured.length : 0 },
    abstention: { correct: outcomeCount("correct-abstention"), unsupported: outcomeCount("unsupported-abstention"), clarifications: outcomeCount("clarification") },
    latency: { samples: measured.length, p50Milliseconds: percentile(measured.map((row) => row.durationMilliseconds), 0.5), p95Milliseconds: percentile(measured.map((row) => row.durationMilliseconds), 0.95), p99Milliseconds: percentile(measured.map((row) => row.durationMilliseconds), 0.99) },
    availabilityMultiplier: null,
  },
};
console.log(JSON.stringify(report, null, 2));
