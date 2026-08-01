import {
  dv7CuratedBenchmark,
  dv7SessionBenchmark,
  type BenchmarkCategory,
} from "@/data/benchmarks/dv7-basic-questions";
import { createDv7BaselineSession, respondDv7Baseline } from "@/lib/lexi/engine";
import { lexiKnowledgeGraph } from "@/modules/knowledge-graph";
import { relationLabels, type SemanticRelation } from "@/modules/semantic";

export type BenchmarkFailureReason =
  | "parser-miss"
  | "wrong-route"
  | "content-miss"
  | "proposition-miss"
  | "memory-miss";

export type BenchmarkResult = {
  id: string;
  category: BenchmarkCategory;
  prompt: string;
  passed: boolean;
  source: string;
  failureReason?: BenchmarkFailureReason;
  detail?: string;
};

export type CoverageReport = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  byCategory: Record<string, { total: number; passed: number; passRate: number }>;
  failureReasons: Partial<Record<BenchmarkFailureReason, number>>;
  failures: BenchmarkResult[];
};

function includesTerms(text: string, terms: readonly string[]): boolean {
  const normalized = text.toLocaleLowerCase("en-US");
  return terms.every((term) => normalized.includes(term.toLocaleLowerCase("en-US")));
}

function propertyPrompt(relation: SemanticRelation, subject: string): string {
  const specialized: Partial<Record<SemanticRelation, string>> = {
    definition: `What is ${subject}?`,
    is_a: `What is the classification of ${subject}?`,
    purpose: `What is ${subject} used for?`,
    mechanism: `How does ${subject} work?`,
    importance: `Why is ${subject} important?`,
    example: `Give me an example of ${subject}.`,
    component: `What is the component of ${subject}?`,
    related_to: `What is ${subject} related to?`,
    location: `Where is ${subject}?`,
    habitat: `Where does ${subject} live?`,
    capital: `What is the capital of ${subject}?`,
    continent: `What continent is ${subject} in?`,
    country: `What country is ${subject} in?`,
    language: `What is the language of ${subject}?`,
    currency: `What is the currency of ${subject}?`,
    color: `What color is ${subject}?`,
    composition: `What is ${subject} made of?`,
    diet: `What does ${subject} eat?`,
    leg_count: `How many legs does ${subject} have?`,
    lifespan: `How long does ${subject} live?`,
    size: `How big is ${subject}?`,
    temperature: `What is the temperature of ${subject}?`,
    symbol: `What is the symbol of ${subject}?`,
    atomic_number: `What is the atomic number of ${subject}?`,
    invented_by: `Who invented ${subject}?`,
    discovered_by: `Who discovered ${subject}?`,
    created_by: `Who created ${subject}?`,
    written_by: `Who wrote ${subject}?`,
    known_for: `What is ${subject} known for?`,
    founded_by: `Who founded ${subject}?`,
    founded_year: `When was ${subject} founded?`,
    birth_year: `When was ${subject} born?`,
    nationality: `What is the nationality of ${subject}?`,
    formula: `What is the formula for ${subject}?`,
    unit: `What is the unit of ${subject}?`,
    year: `What is the year of ${subject}?`,
    cause: `What causes ${subject}?`,
    effect: `What is the effect of ${subject}?`,
    function: `What does ${subject} do?`,
    ability: `What is the ability of ${subject}?`,
    has_part: `What are the parts of ${subject}?`,
    part_of: `What is ${subject} part of?`,
    contains: `What does ${subject} contain?`,
    produces: `What does ${subject} produce?`,
    requires: `What does ${subject} require?`,
    used_by: `What are the users of ${subject}?`,
  };
  return specialized[relation] ??
    `What is the ${relationLabels[relation]} of ${subject}?`;
}

function generatedReachabilityResults(): BenchmarkResult[] {
  const seen = new Set<string>();
  const results: BenchmarkResult[] = [];

  for (const proposition of lexiKnowledgeGraph.allPropositions()) {
    const key = `${proposition.subjectId}\u0000${proposition.predicate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entity = lexiKnowledgeGraph.entity(proposition.subjectId);
    if (!entity) continue;
    const prompt = propertyPrompt(proposition.predicate, entity.name);
    const reply = respondDv7Baseline(prompt);
    const expectedId = `proposition:${proposition.id}`;
    const sourcePassed = reply.trace.source === "knowledge-graph";
    const propositionPassed = reply.trace.matchedExampleIds.includes(expectedId);
    results.push({
      id: `generated-${proposition.subjectId}-${proposition.predicate}`,
      category: "generated-reachability",
      prompt,
      passed: sourcePassed && propositionPassed,
      source: reply.trace.source,
      failureReason: !sourcePassed
        ? reply.trace.source === "safe-fallback"
          ? "parser-miss"
          : "wrong-route"
        : !propositionPassed
          ? "proposition-miss"
          : undefined,
      detail:
        sourcePassed && propositionPassed
          ? undefined
          : `Expected ${expectedId}; got ${reply.trace.matchedExampleIds.join(", ") || "no proposition"}.`,
    });
  }
  return results;
}

function curatedResults(): BenchmarkResult[] {
  return dv7CuratedBenchmark.map((testCase) => {
    const reply = respondDv7Baseline(testCase.prompt);
    const sourcePassed =
      !testCase.expectedSource || reply.trace.source === testCase.expectedSource;
    const contentPassed = includesTerms(reply.text, testCase.expectedTerms);
    return {
      id: testCase.id,
      category: testCase.category,
      prompt: testCase.prompt,
      passed: sourcePassed && contentPassed,
      source: reply.trace.source,
      failureReason: !sourcePassed
        ? reply.trace.source === "safe-fallback"
          ? "parser-miss"
          : "wrong-route"
        : !contentPassed
          ? "content-miss"
          : undefined,
      detail:
        sourcePassed && contentPassed
          ? undefined
          : `Expected source ${testCase.expectedSource ?? "any"} and terms ${testCase.expectedTerms.join(", ")}; received “${reply.text}”.`,
    };
  });
}

function sessionResults(): BenchmarkResult[] {
  const results: BenchmarkResult[] = [];
  for (const scenario of dv7SessionBenchmark) {
    const session = createDv7BaselineSession();
    scenario.turns.forEach((turn, index) => {
      const reply = session.respond(turn.prompt);
      const sourcePassed =
        !turn.expectedSource || reply.trace.source === turn.expectedSource;
      const contentPassed = includesTerms(reply.text, turn.expectedTerms);
      results.push({
        id: `${scenario.id}-${index + 1}`,
        category: "memory-reference",
        prompt: turn.prompt,
        passed: sourcePassed && contentPassed,
        source: reply.trace.source,
        failureReason:
          sourcePassed && contentPassed
            ? undefined
            : reply.trace.source === "safe-fallback"
              ? "memory-miss"
              : !sourcePassed
                ? "wrong-route"
                : "content-miss",
        detail:
          sourcePassed && contentPassed
            ? undefined
            : `Expected ${turn.expectedTerms.join(", ")}; received “${reply.text}”.`,
      });
    });
  }
  return results;
}

export function runDv7CoverageBenchmark(): CoverageReport {
  const results = [
    ...curatedResults(),
    ...sessionResults(),
    ...generatedReachabilityResults(),
  ];
  const passed = results.filter((result) => result.passed).length;
  const byCategory: CoverageReport["byCategory"] = {};
  const failureReasons: CoverageReport["failureReasons"] = {};

  for (const result of results) {
    const category = byCategory[result.category] ?? {
      total: 0,
      passed: 0,
      passRate: 0,
    };
    category.total += 1;
    if (result.passed) category.passed += 1;
    category.passRate = category.passed / category.total;
    byCategory[result.category] = category;
    if (result.failureReason) {
      failureReasons[result.failureReason] =
        (failureReasons[result.failureReason] ?? 0) + 1;
    }
  }

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: passed / results.length,
    byCategory,
    failureReasons,
    failures: results.filter((result) => !result.passed),
  };
}
