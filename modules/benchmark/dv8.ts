import { performance } from "node:perf_hooks";
import { dv8CuratedBlindCases } from "@/data/benchmarks/dv8-blind";
import type { LexiReply } from "@/lib/lexi/types";
import { createLexiSession, respond, respondDv7Baseline } from "@/lib/lexi/engine";
import { lexiKnowledgeGraph } from "@/modules/knowledge-graph";
import { relationLabels, type SemanticRelation } from "@/modules/semantic";
import { contentTokens } from "@/modules/dv8/normalize";
import { dv8LexicalIndex } from "@/modules/dv8";

type MetricCategory = "knowledge" | "language" | "reasoning" | "precision";

type BlindCase = {
  id: string;
  category: MetricCategory;
  prompt: string;
  expectedIntent?: string;
  expectedAny?: string[];
  expectedAll?: string[];
  excluded?: string[];
};

function propositionText(proposition: ReturnType<typeof lexiKnowledgeGraph.allPropositions>[number]) {
  const object = proposition.object;
  if (object.kind === "entity") return lexiKnowledgeGraph.entity(object.entityId)?.name ?? object.entityId;
  if (object.kind === "text") return object.value;
  if (object.kind === "number") return String(object.value);
  if (object.kind === "boolean") return proposition.qualifiers?.scope ?? String(object.value);
  return object.values[0] ?? "";
}

function expectedIntent(relation: SemanticRelation) {
  if (relation === "component" || relation === "has_part") return "components";
  if (relation === "related_to") return "related";
  if (relation === "function") return "purpose";
  return relation;
}

function buildBlindCases(): BlindCase[] {
  const cases: BlindCase[] = [];
  const definitions = lexiKnowledgeGraph.allEntities().filter(
    (entity) => {
      if (!lexiKnowledgeGraph.direct(entity.id, "definition").length) return false;
      return dv8LexicalIndex.resolveExact(entity.name, "definition")?.selected?.entityId === entity.id;
    },
  );
  const templates = [
    (name: string) => `What exactly is ${name}?`,
    (name: string) => `Describe ${name}.`,
    (name: string) => `Tell me about ${name}.`,
    (name: string) => `Give the definition of ${name}.`,
  ];
  for (const entity of definitions) {
    const proposition = lexiKnowledgeGraph.direct(entity.id, "definition")[0];
    const expectedAny = contentTokens(propositionText(proposition)).filter((token) => token.length > 3).slice(0, 3);
    cases.push({
      id: `knowledge:${entity.id}`,
      category: "knowledge",
      prompt: `What is ${entity.name}?`,
      expectedIntent: "definition",
      expectedAny,
    });
    templates.forEach((template, index) => cases.push({
      id: `language:${entity.id}:${index}`,
      category: "language",
      prompt: template(entity.name),
      expectedIntent: "definition",
      expectedAny,
    }));
  }

  const propertyFacts = lexiKnowledgeGraph.allPropositions().filter(
    (proposition) => {
      if (["definition", "is_a", "comparison"].includes(proposition.predicate)) return false;
      const subject = lexiKnowledgeGraph.entity(proposition.subjectId);
      return Boolean(
        subject &&
        dv8LexicalIndex.resolveExact(subject.name, proposition.predicate)?.selected?.entityId === subject.id,
      );
    },
  ).slice(0, 850);
  for (const proposition of propertyFacts) {
    const subject = lexiKnowledgeGraph.entity(proposition.subjectId);
    if (!subject) continue;
    const label = relationLabels[proposition.predicate];
    const expectedAny = contentTokens(propositionText(proposition)).filter((token) => token.length > 2).slice(0, 8);
    cases.push({
      id: `language:property:${proposition.id}`,
      category: "language",
      prompt: `State the ${label} of ${subject.name}.`,
      expectedIntent: expectedIntent(proposition.predicate),
      expectedAny,
    });
  }

  const classifications = lexiKnowledgeGraph.allPropositions()
    .filter((proposition) => proposition.predicate === "is_a" && proposition.object.kind === "entity")
    .slice(0, 180);
  for (const proposition of classifications) {
    if (proposition.object.kind !== "entity") continue;
    const subject = lexiKnowledgeGraph.entity(proposition.subjectId);
    const object = lexiKnowledgeGraph.entity(proposition.object.entityId);
    if (!subject || !object) continue;
    cases.push({
      id: `reasoning:classification:${proposition.id}`,
      category: "reasoning",
      prompt: `Is ${subject.name} a ${object.name}?`,
      expectedAll: ["Yes"],
    });
  }

  for (const entry of dv8CuratedBlindCases) {
    cases.push({
      id: `${entry.category}:curated:${entry.id}`,
      category: entry.category,
      prompt: entry.prompt,
      expectedIntent: entry.intent,
      expectedAll: entry.includes ? [...entry.includes] : undefined,
      excluded: entry.excludes ? [...entry.excludes] : undefined,
    });
  }

  for (const entity of definitions.slice(0, 160)) {
    cases.push({
      id: `precision:unsupported:${entity.id}`,
      category: "precision",
      prompt: `What is the favorite song of ${entity.name}?`,
      expectedIntent: "typed-clarification",
      excluded: ["favorite song is", "Search Module"],
    });
  }
  return cases;
}

function passes(testCase: BlindCase, reply: LexiReply) {
  const lower = reply.text.toLowerCase();
  const replyTokens = new Set(contentTokens(reply.text));
  if (testCase.expectedIntent && reply.trace.interpretedIntent !== testCase.expectedIntent) return false;
  if (testCase.expectedAll?.some((value) => !lower.includes(value.toLowerCase()))) return false;
  if (
    testCase.expectedAny?.length &&
    !testCase.expectedAny.some((value) =>
      lower.includes(value.toLowerCase()) || replyTokens.has(value.toLowerCase()),
    )
  ) return false;
  if (testCase.excluded?.some((value) => lower.includes(value.toLowerCase()))) return false;
  return true;
}

function categoryMetric(cases: BlindCase[], results: boolean[], category: MetricCategory) {
  const indices = cases.map((item, index) => item.category === category ? index : -1).filter((index) => index >= 0);
  const passed = indices.filter((index) => results[index]).length;
  return { passed, total: indices.length, rate: indices.length ? passed / indices.length : 0 };
}

function dialogueMetric() {
  const candidates = lexiKnowledgeGraph.allEntities().filter((entity) => {
    const relations = lexiKnowledgeGraph.direct(entity.id).map((fact) => fact.predicate);
    return relations.includes("definition") && relations.some((relation) => ["purpose", "mechanism", "importance", "habitat", "diet", "component"].includes(relation));
  }).slice(0, 120);
  let passed = 0;
  let total = 0;
  for (const entity of candidates) {
    const relation = lexiKnowledgeGraph.direct(entity.id)
      .map((fact) => fact.predicate)
      .find((candidate) => ["purpose", "mechanism", "importance", "habitat", "diet", "component"].includes(candidate))!;
    const session = createLexiSession();
    session.respond(`What is ${entity.name}?`);
    const reply = session.respond(`What is its ${relationLabels[relation]}?`);
    total += 1;
    if (reply.trace.subjectIds?.includes(entity.id) && !/do not have|could not form/i.test(reply.text)) passed += 1;
  }
  return { passed, total, rate: total ? passed / total : 0 };
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

export function runDv8BlindBenchmark() {
  const cases = buildBlindCases();
  const results = cases.map((testCase) => passes(testCase, respond(testCase.prompt)));
  const baselineResults = cases.map((testCase) => passes(testCase, respondDv7Baseline(testCase.prompt)));
  const latencySamples = cases.slice(0, 300).map((testCase) => {
    const start = performance.now();
    respond(testCase.prompt);
    return performance.now() - start;
  });
  const knowledge = categoryMetric(cases, results, "knowledge");
  const language = categoryMetric(cases, results, "language");
  const reasoning = categoryMetric(cases, results, "reasoning");
  const precision = categoryMetric(cases, results, "precision");
  const baselineKnowledge = categoryMetric(cases, baselineResults, "knowledge");
  const baselineLanguage = categoryMetric(cases, baselineResults, "language");
  const baselineReasoning = categoryMetric(cases, baselineResults, "reasoning");
  const baselinePrecision = categoryMetric(cases, baselineResults, "precision");
  const dialogue = dialogueMetric();
  const passed = results.filter(Boolean).length;
  const baselinePassed = baselineResults.filter(Boolean).length;
  const failures = cases.filter((_, index) => !results[index]).slice(0, 100).map((item) => ({ id: item.id, prompt: item.prompt }));
  return {
    total: cases.length,
    passed,
    passRate: passed / cases.length,
    baselinePassed,
    baselinePassRate: baselinePassed / cases.length,
    measuredAvailabilityGain: baselinePassed ? passed / baselinePassed : null,
    metrics: {
      knowledge,
      languageRobustness: language,
      reasoning,
      dialogue,
      precision,
      latency: {
        samples: latencySamples.length,
        p50Milliseconds: percentile(latencySamples, 0.5),
        p95Milliseconds: percentile(latencySamples, 0.95),
      },
    },
    baselineMetrics: {
      knowledge: baselineKnowledge,
      languageRobustness: baselineLanguage,
      reasoning: baselineReasoning,
      precision: baselinePrecision,
    },
    failures,
  };
}
