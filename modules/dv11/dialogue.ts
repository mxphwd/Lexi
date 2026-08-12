import { dv11NormalizeText, stableHash } from "./normalize";
import type {
  Dv11Binding,
  Dv11ClauseResult,
  Dv11DialogueGoal,
  Dv11DialogueSnapshot,
  Dv11DialogueTurn,
  Dv11ExecutionResult,
  Dv11Proposition,
  Dv11QueryPlan,
  Dv11Value,
} from "./types";

function cloneSnapshot(snapshot: Dv11DialogueSnapshot): Dv11DialogueSnapshot {
  return structuredClone(snapshot);
}

function memoryValue(text: string): { relation: string; object: Dv11Value; subjectId: string } | undefined {
  const normalized = dv11NormalizeText(text).replace(/^(?:actually[:,]?|correction[:,]?|no[, ]+i meant(?: that)?|i meant(?: that)?)\s+/, "");
  const name = normalized.match(/^(?:my name is|call me)\s+([\p{L}\p{M}][\p{L}\p{M}' -]{0,79}?)(?=\s+(?:and|but)\s+|[,.!?]|$)/u)?.[1];
  if (name) return { relation: "user_name", subjectId: "session:user", object: { kind: "text", value: name.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US")) } };
  const age = normalized.match(/^(?:i am|i'm)\s+(\d{1,3})\s+years? old\b/)?.[1];
  if (age && Number(age) <= 130) return { relation: "user_age", subjectId: "session:user", object: { kind: "number", value: Number(age) } };
  const location = normalized.match(/^(?:i live in|my location is|i am from)\s+(.+?)(?=\s+(?:and|but)\s+|[,.!?]|$)/)?.[1];
  if (location) return { relation: "user_location", subjectId: "session:user", object: { kind: "text", value: location } };
  const preference = normalized.match(/^(?:i like|i prefer|my favorite .+ is)\s+(.+?)(?=\s+(?:and|but)\s+|[,.!?]|$)/)?.[1];
  if (preference) return { relation: "user_preference", subjectId: "session:user", object: { kind: "text", value: preference } };
  return undefined;
}

function memoryRelation(text: string) {
  const normalized = dv11NormalizeText(text);
  if (/^(?:what is my name|who am i)\b/.test(normalized)) return "user_name";
  if (/^how old am i\b/.test(normalized)) return "user_age";
  if (/^(?:where do i live|where am i from)\b/.test(normalized)) return "user_location";
  if (/^(?:what do i like|what do i prefer|what is my preference)\b/.test(normalized)) return "user_preference";
  return undefined;
}

function emptyConfidence() {
  return { normalization: 1, segmentation: 1, parsing: 1, entityLinking: 1, senseSelection: 1, routing: 1, evidence: 1, proof: 1, conflict: 1, realization: 0.95 };
}

export class Dv11DialogueState {
  private state: Dv11DialogueSnapshot = {
    turns: [],
    topicStack: [],
    activePropositionIds: [],
    activeEntityIds: [],
    comparisonPair: [],
    unresolvedSlots: [],
    goals: [],
    memories: [],
    corrections: [],
  };

  snapshot() { return cloneSnapshot(this.state); }
  restore(snapshot: Dv11DialogueSnapshot) { this.state = cloneSnapshot(snapshot); }
  parserContext() {
    const last = this.state.turns.at(-1);
    return {
      activeEntityIds: [...this.state.activeEntityIds],
      activeRelation: last?.plan.clauses.at(-1)?.patterns.at(-1)?.relation,
      previousAnswerShape: this.state.requestedAnswerShape,
    };
  }

  resolveReferences(plan: Dv11QueryPlan) {
    let active = [...this.state.activeEntityIds];
    const references: Dv11QueryPlan["dialogueReferences"] = [];
    const clauses = plan.clauses.map((clause) => {
      const normalized = dv11NormalizeText(clause.source.text);
      const refers = /\b(?:it|its|they|them|their|that|those|this|these|the former|the latter|the other one)\b/.test(normalized)
        || /^(?:what about|and what|how about)\b/.test(normalized);
      let resolved = clause;
      if (refers && active.length) {
        const chosen = /\b(?:they|them|their|those|these)\b/.test(normalized) ? active : [active[0]];
        const patterns = clause.patterns.map((pattern, index) => index === 0 && pattern.subject.kind === "variable"
          ? { ...pattern, subject: { kind: "entity", entityId: chosen[0] } as const }
          : pattern);
        resolved = {
          ...clause,
          patterns,
          unresolvedSlots: clause.unresolvedSlots.filter((slot) => slot !== "subject"),
          evidence: [...clause.evidence, `dialogue-reference:${chosen.join(",")}`],
          confidence: { ...clause.confidence, entityLinking: 0.9 },
        };
        references.push({ text: clause.source.text, resolvedEntityIds: chosen, antecedentTurnId: this.state.turns.at(-1)?.id, score: 0.9, evidence: ["grammatical-role", "entity-type", "number", "recency", "plan-local-topic"] });
      }
      const explicit = resolved.mentions.flatMap((mention) => mention.selectedEntityId ? [mention.selectedEntityId] : []);
      if (explicit.length) active = [...new Set(explicit)].slice(0, 8);
      return resolved;
    });
    return {
      ...plan,
      clauses,
      dialogueReferences: references,
    };
  }

  executeOperation(plan: Dv11QueryPlan): Dv11ExecutionResult | undefined {
    const clause = plan.clauses[0];
    if (!clause) return undefined;
    // A dialogue operation may not swallow neighboring clauses. Mixed and
    // multi-part requests continue through the common executor and adapters.
    if (plan.clauses.length !== 1) return undefined;
    if (clause.operation === "explain-proof") {
      const last = this.state.turns.at(-1);
      if (!last) return this.single(plan, "unknown", {}, [], "There is no previous supported answer to prove.");
      return {
        status: last.result.proof.length ? "supported" : "insufficient",
        plan,
        clauses: [{ ...this.baseClause(clause, last.result.proof.length ? "supported" : "insufficient"), proof: structuredClone(last.result.proof), propositions: last.result.clauses.flatMap((item) => structuredClone(item.propositions)), reason: last.result.proof.length ? undefined : "The previous answer has no explicit proof." }],
        proof: structuredClone(last.result.proof),
        calibratedConfidence: last.result.proof.length ? 0.95 : 0,
        failureStage: last.result.proof.length ? undefined : "reasoning",
        failureCode: last.result.proof.length ? undefined : "DV11_NO_PREVIOUS_PROOF",
      };
    }
    if (clause.operation === "recall") {
      const relation = memoryRelation(plan.original);
      const superseded = new Set(this.state.memories.flatMap((item) => item.supersedes ?? []));
      const memory = relation ? [...this.state.memories].reverse().find((item) => item.relation === relation && !superseded.has(item.id) && item.polarity === "positive") : undefined;
      if (!memory) return this.single(plan, "unknown", {}, [], "That value has not been stored in this session.");
      return this.single(plan, "supported", { answer: memory.object }, [memory]);
    }
    if (clause.operation === "retract") {
      const relation = memoryRelation(plan.original.replace(/^(?:forget|retract)\s+/i, "what is my "))
        ?? (/\bname\b/i.test(plan.original) ? "user_name" : /\bage\b/i.test(plan.original) ? "user_age" : /\b(?:location|live|from)\b/i.test(plan.original) ? "user_location" : /\b(?:like|prefer|preference)\b/i.test(plan.original) ? "user_preference" : undefined);
      const superseded = new Set(this.state.memories.flatMap((item) => item.supersedes ?? []));
      const previous = [...this.state.memories].reverse().find((item) => (!relation || item.relation === relation) && !superseded.has(item.id) && item.polarity === "positive");
      if (!previous) return this.single(plan, "unknown", {}, [], "There is no matching active memory to retract.");
      const retraction: Dv11Proposition = { ...previous, id: `session:retraction:${stableHash(`${plan.id}:${previous.id}`)}`, polarity: "negative", supersedes: [previous.id], provenance: [{ sourceId: "session-user", sourceLocation: `turn:${this.state.turns.length + 1}`, extractionMethod: "session", reviewStatus: "source-attested", confidence: 1, createdAt: new Date().toISOString(), license: "user-session-only", disputeStatus: "superseded" }] };
      const result = this.single(plan, "supported", {}, [retraction]);
      result.clauses[0].text = `I removed the stored ${previous.relation.replace(/^user_/, "").replace(/_/g, " ")}.`;
      return result;
    }
    if (clause.operation === "remember" || clause.operation === "correct") {
      let extracted = memoryValue(plan.original);
      if (!extracted && clause.operation === "correct") {
        const raw = dv11NormalizeText(plan.original).match(/^(?:actually|i meant|no,? i meant)\s+(.+)$/)?.[1];
        const superseded = new Set(this.state.memories.flatMap((item) => item.supersedes ?? []));
        const previous = [...this.state.memories].reverse().find((item) => !superseded.has(item.id) && item.polarity === "positive");
        if (raw && previous) extracted = { relation: previous.relation, subjectId: "session:user", object: previous.object.kind === "number" && /^\d+$/.test(raw) ? { kind: "number", value: Number(raw) } : { kind: "text", value: raw.replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US")) } };
      }
      if (!extracted && clause.operation === "correct" && /^(?:that is wrong|that was wrong)/.test(dv11NormalizeText(plan.original))) return this.single(plan, "ambiguous", {}, [], "Supply the corrected value so the previous proposition can be superseded.");
      if (!extracted) return undefined;
      const superseded = new Set(this.state.memories.flatMap((item) => item.supersedes ?? []));
      const previous = this.state.memories.filter((item) => item.relation === extracted.relation && !superseded.has(item.id) && item.polarity === "positive");
      const proposition: Dv11Proposition = {
        id: `session:${stableHash(`${plan.id}:${extracted.relation}:${JSON.stringify(extracted.object)}`)}`,
        subjectId: extracted.subjectId,
        relation: extracted.relation,
        object: extracted.object,
        qualifiers: {},
        provenance: [{ sourceId: "session-user", sourceLocation: `turn:${this.state.turns.length + 1}`, extractionMethod: "session", reviewStatus: "source-attested", confidence: 1, createdAt: new Date().toISOString(), license: "user-session-only", disputeStatus: "undisputed" }],
        polarity: "positive",
      };
      if (previous.length) proposition.supersedes = previous.map((item) => item.id);
      return this.single(plan, "supported", { answer: extracted.object }, [proposition]);
    }
    return undefined;
  }

  private baseClause(clause: Dv11QueryPlan["clauses"][number], status: Dv11ClauseResult["status"]): Dv11ClauseResult {
    return { clauseId: clause.id, status, answerShape: clause.answerShape, bindings: [], propositions: [], proof: [], missingSlots: [], confidence: emptyConfidence(), calibratedConfidence: status === "supported" ? 0.95 : 0 };
  }

  private single(plan: Dv11QueryPlan, status: Dv11ClauseResult["status"], binding: Dv11Binding, propositions: Dv11Proposition[], reason?: string): Dv11ExecutionResult {
    const clause = { ...this.baseClause(plan.clauses[0], status), bindings: Object.keys(binding).length ? [binding] : [], propositions, reason };
    return { status, plan, clauses: [clause], proof: [], calibratedConfidence: clause.calibratedConfidence, failureStage: status === "supported" ? undefined : "retrieval", failureCode: status === "supported" ? undefined : "DV11_DIALOGUE_UNKNOWN" };
  }

  commit(userText: string, answerText: string, plan: Dv11QueryPlan, result: Dv11ExecutionResult) {
    if (["canceled", "error"].includes(result.status)) return;
    const turnId = `turn:${this.state.turns.length + 1}:${stableHash(userText)}`;
    const propositions = result.clauses.flatMap((clause) => clause.propositions);
    const memories = propositions.filter((proposition) => proposition.subjectId === "session:user");
    for (const memory of memories) {
      const superseded = memory.supersedes ?? [];
      if (superseded.length) this.state.corrections.push({ turnId, supersededPropositionIds: superseded, replacementIds: [memory.id] });
      this.state.memories.push(memory);
    }
    const entities = [...new Set([
      ...plan.clauses.flatMap((clause) => clause.mentions.flatMap((mention) => mention.selectedEntityId ? [mention.selectedEntityId] : [])),
      ...propositions.flatMap((proposition) => [proposition.subjectId, ...(proposition.object.kind === "entity" ? [proposition.object.entityId] : [])]),
    ].filter((id) => !id.startsWith("session:")))];
    if (entities.length) {
      this.state.activeEntityIds = entities.slice(0, 8);
      this.state.topicStack = [...new Set([...entities, ...this.state.topicStack])].slice(0, 16);
    }
    this.state.activePropositionIds = propositions.map((proposition) => proposition.id).slice(0, 64);
    this.state.comparisonPair = plan.clauses.find((clause) => clause.operation === "compare")?.mentions.flatMap((mention) => mention.selectedEntityId ? [mention.selectedEntityId] : []).slice(0, 2) ?? [];
    this.state.requestedAnswerShape = plan.clauses.at(-1)?.answerShape;
    this.state.unresolvedSlots = plan.clauses.flatMap((clause) => clause.unresolvedSlots);
    const goals: Dv11DialogueGoal[] = plan.clauses.map((clause, index) => ({ id: `${turnId}:goal:${index}`, type: clause.operation === "compare" ? "compare" : clause.operation === "remember" ? "remember" : clause.operation === "clarify" ? "clarify" : clause.answerShape === "entities" ? "list" : clause.answerShape === "explanation" ? "explain" : "answer", status: result.clauses[index]?.status === "supported" ? "satisfied" : "pending", unresolvedSlots: [...(result.clauses[index]?.missingSlots ?? [])], createdTurnId: turnId }));
    this.state.goals.push(...goals);
    const turn: Dv11DialogueTurn = { id: turnId, userText, answerText, plan: structuredClone(plan), result: structuredClone(result), activeEntityIds: [...entities], createdAt: new Date().toISOString(), canceled: false };
    this.state.turns.push(turn);
    if (this.state.turns.length > 128) this.state.turns.splice(0, this.state.turns.length - 128);
    if (this.state.goals.length > 256) this.state.goals.splice(0, this.state.goals.length - 256);
    if (this.state.memories.length > 256) this.state.memories.splice(0, this.state.memories.length - 256);
  }
}
