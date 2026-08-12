import type { LexiReply } from "@/lib/lexi/types";
import { combineClauseReplies } from "@/modules/discourse";
import { analyseSentence } from "@/modules/search";
import { calibrateDv11Result } from "./calibration";
import { Dv11DialogueState } from "./dialogue";
import { executeDv11Plan } from "./executor";
import { Dv11PackageRegistry } from "./packages";
import { parseDv11Query } from "./parser";
import { realizeDv11Result } from "./realizer";
import { createDefaultDv11ResourceClient, type Dv11KnowledgeResourceClient } from "./resources";
import { dv11KnowledgeStore, type Dv11KnowledgeStore } from "./store";
import type {
  Dv11ClausePlan,
  Dv11ClauseResult,
  Dv11EngineOptions,
  Dv11ExecutionResult,
  Dv11Proposition,
  Dv11QueryPlan,
  Dv11TraceStage,
} from "./types";

export type Dv11LegacyResponder = (input: string) => LexiReply | Promise<LexiReply>;

const nonFactualSources = new Set<LexiReply["trace"]["source"]>([
  "core-phrase",
  "session-memory",
  "safe-fallback",
]);

const relationAliases: Record<string, string[]> = {
  definition: ["definition", "define", "meaning"],
  is_a: ["is_a", "classification", "member"],
  component: ["component", "has_part", "part"],
  has_part: ["component", "has_part", "part"],
  location: ["location", "habitat", "country", "continent"],
  purpose: ["purpose", "function", "requires"],
  mechanism: ["mechanism", "process"],
  size: ["size", "diameter", "length"],
  average_distance: ["distance", "average_distance"],
};

function legacyMatchesRequestedRelation(clause: Dv11ClausePlan, reply: LexiReply) {
  const relation = clause.patterns[0]?.relation;
  if (!relation) return false;
  const accepted = [relation, ...(relationAliases[relation] ?? [])].map((value) => value.replace(/_/g, " "));
  const description = `${reply.trace.interpretedIntent.replace(/^dv\d+:/, "")} ${reply.trace.selectedStructure}`.replace(/_/g, " ");
  return accepted.some((value) => description.includes(value));
}

function preferTypedResult(plan: Dv11ClausePlan, result: Dv11ClauseResult, legacy: LexiReply) {
  if (plan.operation === "lexical" && ["supported", "insufficient"].includes(result.status) && Boolean(result.lexicalClaims?.length)) return true;
  if (plan.operation === "infer") return true;
  if (["explain-proof", "remember", "recall", "correct", "retract"].includes(plan.operation)
    && ["supported", "contradicted"].includes(result.status)) return true;
  if (result.status === "insufficient" && result.propositions.length > 0) return true;
  // A selected sense is enough for a definition, but it is not a substitute
  // for DV9's typed list-senses, usage, association, or provenance operations.
  if (plan.mentions.some((mention) => mention.selectedSenseId) && result.propositions.length > 0
    && !(legacy.trace.source === "dv9-data-engine" && legacy.trace.interpretedIntent !== "dv9:define")) return true;
  const relation = plan.patterns[0]?.relation;
  if (["procedure", "state_transition"].includes(relation ?? "") && result.propositions.length > 0) return true;
  if (relation === "size" && result.propositions.length > 0 && !legacyMatchesRequestedRelation(plan, legacy)) return true;
  return false;
}

function compatibleLegacy(clause: Dv11ClausePlan, reply: LexiReply) {
  if (reply.trace.source === "safe-fallback" || reply.trace.interpretedIntent === "unknown") return false;
  if (clause.unresolvedSlots.includes("entity-sense")) return false;
  if (/typed-clarification|abstain|unsupported|unknown-relation/.test(reply.trace.interpretedIntent)
    || /does not map to a supported|do not have a subject-compatible|cannot support that factual/i.test(reply.text)) return true;
  if (nonFactualSources.has(reply.trace.source)) return true;
  if (clause.operation === "calculate") return /reasoning|arithmetic|percent|average|sequence|logic/.test(reply.trace.interpretedIntent);
  if (/reasoning:logic|reasoning:sequence|reasoning:text/.test(reply.trace.interpretedIntent)) return true;
  if (clause.operation === "compare") return /comparison|compare|difference|similarity/.test(reply.trace.interpretedIntent);
  const constraintText = [reply.text, ...reply.trace.matchedTerms, ...(reply.trace.proof ?? [])].join(" ").toLocaleLowerCase("en-US");
  const requestedTargets = clause.filters
    .filter((filter) => filter.kind === "condition" && filter.expression.kind === "counterfactual")
    .map((filter) => filter.kind === "condition" && filter.expression.kind === "counterfactual" ? filter.expression.premiseText.replace(/^target:/, "").toLocaleLowerCase("en-US") : "")
    .filter(Boolean);
  if (requestedTargets.some((target) => !constraintText.includes(target))) return false;
  if ((reply.trace.source === "context-pattern" || reply.trace.source === "exact-example") && reply.trace.confidence >= 0.75) {
    const stop = new Set(["what", "who", "when", "where", "why", "which", "how", "is", "are", "was", "were", "the", "a", "an", "to", "of", "in", "it", "me"]);
    const requested = clause.source.text.toLocaleLowerCase("en-US").match(/[a-z0-9]+/g)?.filter((token) => !stop.has(token)) ?? [];
    const candidate = `${reply.text} ${reply.trace.interpretedIntent} ${reply.trace.matchedTerms.join(" ")}`.toLocaleLowerCase("en-US");
    const overlap = requested.filter((token) => candidate.includes(token)).length;
    if (overlap >= Math.min(2, Math.max(1, requested.length))) return true;
  }
  if (clause.temporal.length || clause.quantifiers.length || clause.order.length || clause.negated) {
    const structuralEvidence = `${reply.trace.interpretedIntent} ${reply.trace.selectedStructure} ${reply.trace.matchedTerms.join(" ")} ${(reply.trace.proof ?? []).join(" ")}`;
    if (clause.temporal.length && !/time|year|date|histor|current|temporal/.test(structuralEvidence)) return false;
    if (clause.quantifiers.length && !/quant|count|aggregate|all|any|none|exact/.test(structuralEvidence)) return false;
    if (clause.order.length && !/comparison|select|order|rank|closest|largest|smallest/.test(structuralEvidence)) return false;
    if (clause.negated && !/negat|not|false|boolean|classification/.test(structuralEvidence) && !/\b(?:not|cannot|no|yes)\b/i.test(reply.text)) return false;
  }
  const relation = clause.patterns[0]?.relation;
  if (!relation) return reply.trace.confidence >= 0.8;
  const accepted = new Set([relation, ...(relationAliases[relation] ?? [])].map((value) => value.replace(/_/g, " ")));
  const intent = reply.trace.interpretedIntent.replace(/^dv\d+:/, "").replace(/_/g, " ");
  const structure = reply.trace.selectedStructure.replace(/_/g, " ");
  const relationMatch = [...accepted].some((value) => intent.includes(value) || structure.includes(value));
  const requestedSubjects = clause.mentions.flatMap((mention) => mention.grammaticalRole === "subject" && mention.selectedEntityId ? [mention.selectedEntityId] : []);
  const subjectMatch = !requestedSubjects.length || !reply.trace.subjectIds?.length || requestedSubjects.some((id) => reply.trace.subjectIds?.includes(id));
  if (relationMatch && subjectMatch && reply.trace.confidence >= 0.6) return true;
  if (subjectMatch && reply.trace.confidence >= 0.55 && clause.filters.length === 0) return true;
  return subjectMatch && reply.trace.confidence >= 0.8 && reply.trace.source !== "context-pattern" && reply.trace.source !== "exact-example";
}

function legacyMetadata(reply: LexiReply): NonNullable<Dv11ClauseResult["legacyMetadata"]> {
  return {
    source: reply.trace.source,
    interpretedIntent: reply.trace.interpretedIntent,
    selectedStructure: reply.trace.selectedStructure,
    matchedExampleIds: [...reply.trace.matchedExampleIds],
    matchedTerms: [...reply.trace.matchedTerms],
    subjectIds: [...(reply.trace.subjectIds ?? [])],
    confidence: reply.trace.confidence,
    proof: [...(reply.trace.proof ?? [])],
  };
}

function legacyProposition(clause: Dv11ClausePlan, reply: LexiReply): Dv11Proposition | undefined {
  const requestedRelation = clause.patterns[0]?.relation;
  if (!requestedRelation || nonFactualSources.has(reply.trace.source) || /clarification|abstain|unknown|error/.test(reply.trace.interpretedIntent)) return undefined;
  const relation = legacyMatchesRequestedRelation(clause, reply) ? requestedRelation : `legacy:${reply.trace.interpretedIntent.replace(/[^a-z0-9]+/gi, "_")}`;
  const subject = clause.patterns[0]?.subject;
  const subjectId = subject?.kind === "entity" ? subject.entityId : reply.trace.subjectIds?.[0];
  if (!subjectId) return undefined;
  return {
    id: `legacy-adapter:${reply.trace.source}:${clause.id}`,
    subjectId,
    relation,
    object: { kind: "text", value: reply.text.replace(/[.!?]+$/, "") },
    qualifiers: {},
    provenance: [{
      sourceId: reply.trace.source,
      sourceLocation: reply.trace.matchedExampleIds[0] ?? reply.trace.selectedStructure,
      extractionMethod: "imported",
      reviewStatus: reply.trace.source === "full-dictionary" || reply.trace.source === "dv9-data-engine" ? "source-attested" : "mechanically-derived",
      confidence: reply.trace.confidence,
      createdAt: "2026-08-12",
      license: reply.trace.source === "full-dictionary" ? "CC-BY-SA-4.0" : reply.trace.source === "dv9-data-engine" ? "source-specific-DV9-manifest" : "alphaine-project-data",
      disputeStatus: "undisputed",
    }],
    polarity: "positive",
  };
}

function wrapLegacy(clause: Dv11ClausePlan, reply: LexiReply, existing?: Dv11ClauseResult): Dv11ClauseResult {
  const proposition = legacyProposition(clause, reply);
  const preserveExisting = Boolean(existing && legacyMatchesRequestedRelation(clause, reply));
  const proof = (reply.trace.proof ?? []).map((explanation, index) => ({
    id: `legacy-proof:${clause.id}:${index}`,
    ruleId: "legacy-plugin-adapter",
    premiseIds: reply.trace.matchedExampleIds,
    explanation,
  }));
  const confidence = {
    ...clause.confidence,
    evidence: proposition || reply.trace.matchedExampleIds.length ? Math.min(0.85, reply.trace.confidence) : 0.3,
    proof: proof.length ? Math.min(0.8, reply.trace.confidence) : proposition ? 0.55 : 0.3,
    conflict: 1,
    realization: Math.min(0.9, reply.trace.confidence),
  };
  const calibratedStatus = /clarification|clarify/.test(reply.trace.interpretedIntent)
    ? "ambiguous" as const
    : /abstain|unsupported|unknown-relation/.test(reply.trace.interpretedIntent)
        || /does not map to a supported|do not have a subject-compatible|cannot support that factual/i.test(reply.text)
      ? "unknown" as const
      : undefined;
  const realizeBoundPropositions = preserveExisting && Boolean(existing?.propositions.some((proposition) => proposition.id.startsWith("dv11:")));
  return {
    clauseId: clause.id,
    status: calibratedStatus ?? (existing && (existing.propositions.length > 0 || existing.proof.length > 0)
      && ["contradicted", "insufficient", "ambiguous", "partial"].includes(existing.status)
      ? existing.status
      : "supported"),
    answerShape: clause.answerShape,
    bindings: [],
    propositions: preserveExisting && existing?.propositions.length ? existing.propositions : proposition ? [proposition] : [],
    proof: [...(preserveExisting ? existing?.proof ?? [] : []), ...proof].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index),
    missingSlots: [],
    confidence,
    calibratedConfidence: 0,
    text: realizeBoundPropositions ? undefined : reply.text,
    legacyMetadata: legacyMetadata(reply),
  };
}

function combineResult(plan: Dv11QueryPlan, clauses: Dv11ClauseResult[]): Dv11ExecutionResult {
  const groupedClauses = clauses.map((clause, index) => {
    const clausePlan = plan.clauses[index];
    const constraintCount = clausePlan.filters.length + clausePlan.quantifiers.length + clausePlan.temporal.length + clausePlan.conditions.length + clausePlan.order.length;
    return { ...clause, calibrationGroup: { parser: clausePlan.pluginId, route: clausePlan.operation, intent: clausePlan.speechAct, relation: clausePlan.patterns[0]?.relation, difficulty: constraintCount > 1 ? "multi-constraint" as const : plan.clauses.length > 1 || clausePlan.patterns.length > 1 ? "compositional" as const : "basic" as const } };
  });
  const statuses = new Set(groupedClauses.map((clause) => clause.status));
  const status = statuses.size === 1 ? groupedClauses[0]?.status ?? "unknown" : "partial";
  const failed = groupedClauses.find((clause) => !["supported", "contradicted"].includes(clause.status));
  const failureStage = failed?.status === "canceled" ? "state-mutation"
    : failed?.status === "error" ? "reasoning"
      : failed?.status === "ambiguous" ? "parsing"
        : failed?.status === "insufficient" || failed?.status === "unknown" ? "retrieval"
          : undefined;
  return {
    status,
    plan,
    clauses: groupedClauses,
    proof: groupedClauses.flatMap((clause) => clause.proof),
    calibratedConfidence: 0,
    failureStage,
    failureCode: failed ? `DV11_${failed.status.toLocaleUpperCase("en-US")}` : undefined,
  };
}

function stage(stage: Dv11TraceStage["stage"], status: Dv11TraceStage["status"], code: string, detail: string, confidence?: number, durationMilliseconds?: number): Dv11TraceStage {
  return { stage, status, code, detail, confidence, durationMilliseconds };
}

function replyFromResult(input: string, result: Dv11ExecutionResult, stages: Dv11TraceStage[], store: Dv11KnowledgeStore): LexiReply {
  const realized = realizeDv11Result(result, store);
  stages.push(stage("realization", "passed", "DV11_REALIZED", `Realized ${realized.parts.length} ordered clause result${realized.parts.length === 1 ? "" : "s"}.`, result.calibratedConfidence));
  const analysis = analyseSentence(input);
  const propositions = result.clauses.flatMap((clause) => clause.propositions);
  const lexicalClaims = result.clauses.flatMap((clause) => clause.lexicalClaims ?? []);
  const sources = [
    ...propositions.flatMap((proposition) => proposition.provenance),
    ...lexicalClaims.flatMap((claim) => claim.provenance),
  ].map((source) => ({ sourceId: source.sourceId, sourceLocation: source.sourceLocation, reviewStatus: source.reviewStatus }));
  const subjects = [...new Set(propositions.flatMap((proposition) => [proposition.subjectId, ...(proposition.object.kind === "entity" ? [proposition.object.entityId] : [])]))];
  const legacy = result.clauses.map((clause) => clause.legacyMetadata).filter((value): value is NonNullable<typeof value> => Boolean(value));
  const allLegacy = legacy.length === result.clauses.length;
  const combinedLegacy = allLegacy && legacy.length > 1
    ? combineClauseReplies(input, result.clauses.map((clause, index) => ({
        text: clause.text ?? realized.parts[index].text,
        trace: {
          normalizedInput: result.plan.clauses[index].source.text,
          sentenceMode: result.plan.clauses[index].mode,
          interpretedIntent: legacy[index].interpretedIntent,
          confidence: legacy[index].confidence,
          matchedExampleIds: legacy[index].matchedExampleIds,
          matchedTerms: legacy[index].matchedTerms,
          selectedStructure: legacy[index].selectedStructure,
          source: legacy[index].source,
          subjectIds: legacy[index].subjectIds,
          proof: legacy[index].proof,
        },
      })))
    : undefined;
  const directRelation = !allLegacy && result.plan.clauses.length === 1 ? result.plan.clauses[0].patterns[0]?.relation : undefined;
  const relationIntent = (relation?: string) => relation?.startsWith("property:")
    ? "typed-clarification"
    : directRelation === "component" || directRelation === "has_part"
      ? "components"
      : directRelation === "related_to"
        ? "related"
        : directRelation === "function"
          ? "purpose"
          : relation;
  const directIntent = result.plan.clauses.length === 1 && result.plan.clauses[0].operation === "remember" && /^my name is\b/i.test(result.plan.original)
    ? "introduction"
    : relationIntent(directRelation);
  const clauseIntents = result.plan.clauses.map((clause, index) => {
    const metadata = result.clauses[index]?.legacyMetadata;
    if (metadata) return metadata.interpretedIntent;
    const clauseResult = result.clauses[index];
    if (clauseResult && !["supported", "contradicted"].includes(clauseResult.status) && clause.patterns[0]?.relation === "related_to") return "typed-clarification";
    return relationIntent(clause.patterns[0]?.relation) ?? `${clause.operation}:dialogue`;
  });
  return {
    text: combinedLegacy?.text ?? realized.text,
    trace: {
      normalizedInput: result.plan.normalized,
      sentenceMode: analysis.mode,
      interpretedIntent: result.plan.clauses.length === 1 && result.plan.clauses[0].operation === "explain-proof"
        ? "dv10:proof"
        : directIntent
          ? directIntent
        : combinedLegacy?.trace.interpretedIntent ?? (allLegacy
        ? legacy.map((item) => item.interpretedIntent).join(" + ")
        : result.plan.clauses.map((clause) => `dv11:${clause.operation}:${clause.patterns[0]?.relation ?? "dialogue"}`).join(" + ")),
      confidence: result.calibratedConfidence,
      matchedExampleIds: allLegacy ? legacy.flatMap((item) => item.matchedExampleIds) : [
        ...propositions.map((proposition) => `proposition:${proposition.id}`),
        ...lexicalClaims.map((claim) => `lexical-claim:${claim.id}`),
      ],
      matchedTerms: allLegacy ? legacy.flatMap((item) => item.matchedTerms) : result.plan.clauses.flatMap((clause) => clause.evidence),
      selectedStructure: combinedLegacy?.trace.selectedStructure ?? (allLegacy && legacy.length === 1 ? legacy[0].selectedStructure : "dv11:unified-semantic-runtime"),
      source: combinedLegacy?.trace.source ?? (allLegacy
        ? (legacy.length === 1 ? legacy[0].source : "combined-response")
        : directIntent === "typed-clarification" || (result.status === "unknown" && result.plan.clauses.some((clause) => clause.temporal.length > 0))
          ? "language-engine"
          : "semantic-runtime"),
      clauseCount: result.clauses.length,
      clauseIntents: combinedLegacy?.trace.clauseIntents ?? (allLegacy ? legacy.map((item) => item.interpretedIntent) : clauseIntents),
      subjectIds: allLegacy ? [...new Set(legacy.flatMap((item) => item.subjectIds))] : subjects,
      proof: result.proof.map((proof) => proof.explanation),
      runtimeVersion: "DV11",
      executionStatus: result.status,
      failureStage: result.failureStage,
      failureCode: result.failureCode,
      propositionIds: [...propositions.map((proposition) => proposition.id), ...lexicalClaims.map((claim) => claim.id)],
      sources,
      liveKnowledge: store.stats(),
      confidenceComponents: result.clauses[0]?.confidence,
      stages,
      clauseResults: result.clauses.map((clause) => ({ clauseId: clause.clauseId, status: clause.status, confidence: clause.calibratedConfidence, propositionIds: [...clause.propositions.map((proposition) => proposition.id), ...(clause.lexicalClaims ?? []).map((claim) => claim.id)] })),
    },
  };
}

export class Dv11RuntimeSession {
  readonly dialogue: Dv11DialogueState;
  readonly packages: Dv11PackageRegistry;

  constructor(
    readonly store: Dv11KnowledgeStore = dv11KnowledgeStore,
    readonly resources: Dv11KnowledgeResourceClient | undefined = createDefaultDv11ResourceClient(),
  ) {
    this.dialogue = new Dv11DialogueState(store);
    this.packages = new Dv11PackageRegistry(store);
  }

  private prepare(input: string, options: Dv11EngineOptions) {
    const stages: Dv11TraceStage[] = [];
    const parsed = parseDv11Query(input, this.dialogue.parserContext(), this.store, {
      maximumCharacters: options.maximumCharacters ?? 12_000,
      maximumTokens: options.maximumTokens ?? 2_000,
      maximumClauses: options.maximumClauses ?? 64,
      maximumOperations: options.maximumOperations ?? 256,
    });
    stages.push(stage("normalization", parsed.request.warnings.length ? "failed" : "passed", parsed.request.warnings[0] ?? "DV11_NORMALIZED", `${parsed.request.tokens.length} tokens; ${parsed.request.complexity.estimatedOperations} estimated operations.`, parsed.request.warnings.length ? 0 : 1));
    stages.push(stage("segmentation", "passed", "DV11_SEGMENTED", `${parsed.request.clauses.length} scope-aware clause${parsed.request.clauses.length === 1 ? "" : "s"}.`, parsed.plan.clauses[0]?.confidence.segmentation));
    stages.push(stage("parsing", parsed.plan.clauses.length ? "passed" : "failed", parsed.plan.clauses.length ? "DV11_TYPED_PLAN" : "DV11_NO_PLAN", `${parsed.plan.clauses.length} selected plan${parsed.plan.clauses.length === 1 ? "" : "s"}; ${parsed.plan.alternatives.reduce((sum, item) => sum + item.plans.length, 0)} retained alternatives.`, parsed.plan.clauses[0]?.confidence.parsing));
    const resolvedPlan = this.dialogue.resolveReferences(parsed.plan);
    stages.push(stage("entity-linking", resolvedPlan.clauses.some((clause) => clause.unresolvedSlots.includes("entity-sense")) ? "partial" : "passed", "DV11_ENTITY_CANDIDATES", `${resolvedPlan.clauses.flatMap((clause) => clause.mentions).length} indexed mention${resolvedPlan.clauses.flatMap((clause) => clause.mentions).length === 1 ? "" : "s"}.`, resolvedPlan.clauses[0]?.confidence.entityLinking));
    return { request: parsed.request, plan: resolvedPlan, stages };
  }

  private async resolvePackages(input: string, prepared: ReturnType<Dv11RuntimeSession["prepare"]>, options: Dv11EngineOptions) {
    if (!this.resources) {
      prepared.stages.push(stage("resource-loading", "skipped", "DV11_RESOURCE_CLIENT_UNAVAILABLE", "No Worker resource client is active in this runtime."));
      return prepared;
    }
    const start = performance.now();
    try {
      const response = await this.resources.resolve(prepared.plan, this.packages.loadedPackageIds(), options.signal);
      let installed = 0;
      for (const pack of response.packages) {
        const result = await this.packages.installResolved(pack, pack.manifest.capabilities, options.signal);
        if (!result.fromCache) installed += 1;
      }
      const matches = Object.values(response.matched).reduce((sum, values) => sum + values.length, 0);
      prepared.stages.push(stage("resource-loading", "passed", "DV11_RESOURCE_PACKAGES", `${installed} package${installed === 1 ? "" : "s"} installed from ${matches} global-index match${matches === 1 ? "" : "es"}; ${this.store.stats().queryableClaims} claims are live and queryable.`, 1, performance.now() - start));
      if (!response.packages.length) return prepared;
      const reparsed = this.prepare(input, options);
      reparsed.stages = [
        ...prepared.stages,
        stage("parsing", "passed", "DV11_REPARSED_AFTER_PACKAGE_LOAD", `Reparsed, relinked, and rerouted ${reparsed.plan.clauses.length} clause${reparsed.plan.clauses.length === 1 ? "" : "s"} after matched package installation.`, reparsed.plan.clauses[0]?.confidence.parsing),
      ];
      return reparsed;
    } catch (error) {
      if (options.signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw error;
      prepared.stages.push(stage("resource-loading", "failed", "DV11_RESOURCE_LOAD_FAILED", error instanceof Error ? error.message : String(error), 0, performance.now() - start));
      return prepared;
    }
  }

  respond(input: string, legacy?: (input: string) => LexiReply, options: Dv11EngineOptions = {}) {
    const snapshot = this.dialogue.snapshot();
    const prepared = this.prepare(input, options);
    if (prepared.request.warnings.length) {
      const result = { ...combineResult(prepared.plan, prepared.plan.clauses.map((clause) => ({ clauseId: clause.id, status: "insufficient" as const, answerShape: clause.answerShape, bindings: [], propositions: [], proof: [], missingSlots: prepared.request.warnings, reason: `The request exceeds the documented ${prepared.request.warnings.join(", ")} budget.`, confidence: { ...clause.confidence, evidence: 0, proof: 0, realization: 0 }, calibratedConfidence: 0 }))), failureStage: "normalization" as const, failureCode: "DV11_COMPLEXITY_LIMIT" };
      const reply = replyFromResult(input, result, prepared.stages, this.store);
      return { reply, result };
    }
    let result = this.dialogue.executeOperation(prepared.plan) ?? executeDv11Plan(prepared.plan, this.store, options);
    result = combineResult(prepared.plan, result.clauses);
    if (legacy) {
      result = combineResult(prepared.plan, result.clauses.map((clause, index) => {
        const legacyReply = legacy(prepared.plan.clauses[index].source.text);
        if (legacyReply.trace.executionStatus === "canceled" || legacyReply.trace.executionStatus === "error") return { ...clause, status: legacyReply.trace.executionStatus, text: legacyReply.text, legacyMetadata: legacyMetadata(legacyReply) };
        if (preferTypedResult(prepared.plan.clauses[index], clause, legacyReply)) return clause;
        if (legacyReply.trace.source === "safe-fallback" && !["supported", "contradicted"].includes(clause.status) && clause.propositions.length === 0) {
          return { ...clause, text: legacyReply.text, legacyMetadata: legacyMetadata(legacyReply) };
        }
        if (!compatibleLegacy(prepared.plan.clauses[index], legacyReply)) return clause;
        return wrapLegacy(prepared.plan.clauses[index], legacyReply, clause);
      }));
    }
    result = calibrateDv11Result(result);
    const retainedClaims = result.clauses.reduce((sum, clause) => sum + clause.propositions.length + (clause.lexicalClaims?.length ?? 0), 0);
    prepared.stages.push(stage("retrieval", retainedClaims ? "passed" : "partial", "DV11_RETRIEVAL", `${retainedClaims} proposition or lexical claim${retainedClaims === 1 ? "" : "s"} retained; ${this.store.stats().queryableClaims} live claims are queryable.`, result.clauses[0]?.confidence.evidence));
    prepared.stages.push(stage("reasoning", result.proof.length ? "passed" : "partial", "DV11_PROOF", `${result.proof.length} proof step${result.proof.length === 1 ? "" : "s"}.`, result.clauses[0]?.confidence.proof));
    prepared.stages.push(stage("calibration", "passed", "DV11_CALIBRATED", `Calibrated result confidence ${result.calibratedConfidence.toFixed(4)}.`, result.calibratedConfidence));
    const reply = replyFromResult(input, result, prepared.stages, this.store);
    if (result.status === "canceled" || result.status === "error" || options.signal?.aborted) this.dialogue.restore(snapshot);
    else this.dialogue.commit(input, reply.text, prepared.plan, result);
    return { reply, result };
  }

  async respondAsync(input: string, legacy?: Dv11LegacyResponder, options: Dv11EngineOptions = {}) {
    const snapshot = this.dialogue.snapshot();
    let prepared = this.prepare(input, options);
    if (prepared.request.warnings.length) return this.respond(input, undefined, options);
    try {
      prepared = await this.resolvePackages(input, prepared, options);
    } catch (error) {
      this.dialogue.restore(snapshot);
      const canceled = options.signal?.aborted || error instanceof DOMException && error.name === "AbortError";
      const result = executeDv11Plan(prepared.plan, this.store, { ...options, signal: canceled ? AbortSignal.abort() : options.signal });
      const reply = replyFromResult(input, result, [...prepared.stages, stage("resource-loading", canceled ? "canceled" : "failed", canceled ? "DV11_RESOURCE_CANCELED" : "DV11_RESOURCE_ERROR", error instanceof Error ? error.message : String(error), 0)], this.store);
      return { reply, result };
    }
    let result = this.dialogue.executeOperation(prepared.plan) ?? executeDv11Plan(prepared.plan, this.store, options);
    result = combineResult(prepared.plan, result.clauses);
    if (legacy) {
      const clauses: Dv11ClauseResult[] = [];
      for (let index = 0; index < result.clauses.length; index += 1) {
        const clause = result.clauses[index];
        if (options.signal?.aborted) break;
        if (prepared.plan.clauses[index].operation === "lexical" && ["supported", "insufficient"].includes(clause.status) && clause.lexicalClaims?.length) {
          clauses.push(clause);
          continue;
        }
        const legacyReply = await legacy(prepared.plan.clauses[index].source.text);
        if (legacyReply.trace.executionStatus === "canceled" || legacyReply.trace.executionStatus === "error") { clauses.push({ ...clause, status: legacyReply.trace.executionStatus, text: legacyReply.text, legacyMetadata: legacyMetadata(legacyReply) }); continue; }
        if (preferTypedResult(prepared.plan.clauses[index], clause, legacyReply)) { clauses.push(clause); continue; }
        if (legacyReply.trace.source === "safe-fallback" && !["supported", "contradicted"].includes(clause.status) && clause.propositions.length === 0) {
          clauses.push({ ...clause, text: legacyReply.text, legacyMetadata: legacyMetadata(legacyReply) });
          continue;
        }
        clauses.push(compatibleLegacy(prepared.plan.clauses[index], legacyReply) ? wrapLegacy(prepared.plan.clauses[index], legacyReply, clause) : clause);
      }
      result = combineResult(prepared.plan, clauses);
    }
    if (options.signal?.aborted) {
      this.dialogue.restore(snapshot);
      result = { ...result, status: "canceled", calibratedConfidence: 0, failureStage: "state-mutation", failureCode: "DV11_CANCELED", clauses: result.clauses.map((clause) => ({ ...clause, status: "canceled", calibratedConfidence: 0 })) };
    }
    result = calibrateDv11Result(result);
    const retainedClaims = result.clauses.reduce((sum, clause) => sum + clause.propositions.length + (clause.lexicalClaims?.length ?? 0), 0);
    prepared.stages.push(stage("retrieval", retainedClaims ? "passed" : "partial", "DV11_RETRIEVAL", `${retainedClaims} proposition or lexical claim${retainedClaims === 1 ? "" : "s"} retained; ${this.store.stats().queryableClaims} live claims are queryable.`, result.clauses[0]?.confidence.evidence));
    prepared.stages.push(stage("reasoning", result.proof.length ? "passed" : "partial", "DV11_PROOF", `${result.proof.length} proof steps.`, result.clauses[0]?.confidence.proof));
    prepared.stages.push(stage("calibration", "passed", "DV11_CALIBRATED", `Calibrated result confidence ${result.calibratedConfidence.toFixed(4)}.`, result.calibratedConfidence));
    const reply = replyFromResult(input, result, prepared.stages, this.store);
    if (result.status === "canceled" || result.status === "error") this.dialogue.restore(snapshot);
    else this.dialogue.commit(input, reply.text, prepared.plan, result);
    return { reply, result };
  }

  snapshot() { return this.dialogue.snapshot(); }
}
