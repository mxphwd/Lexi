import type { LexiReply } from "@/lib/lexi/types";
import { dv10Normalize } from "./normalize";
import type { Dv10DialogueSnapshot, Dv10DialogueTurn } from "./types";

function goalFor(reply: LexiReply): Dv10DialogueTurn["goal"] {
  const intent = reply.trace.interpretedIntent;
  if (/clarif/.test(intent)) return "clarify";
  if (/sense|definition/.test(intent)) return "disambiguate";
  if (/comparison/.test(intent)) return "compare";
  if (/list|member|select/.test(intent)) return "list";
  if (/reason|arithmetic|logic/.test(intent)) return "reason";
  return "answer";
}

export class Dv10DialogueState {
  private readonly turns: Dv10DialogueTurn[] = [];
  private activeLexicalTerm?: string;
  private activeLexicalContext?: string;

  recordTurn(question: string, reply: LexiReply) {
    const term = reply.trace.matchedTerms.find((item) => item.startsWith("term:"))?.slice(5);
    const context = reply.trace.matchedTerms.find((item) => item.startsWith("context:"))?.slice(8);
    if (term) this.activeLexicalTerm = term;
    if (context) this.activeLexicalContext = context;
    this.turns.push({
      question,
      answer: reply.text,
      subjectTexts: [...(reply.trace.subjectIds ?? [])],
      relation: reply.trace.interpretedIntent.replace(/^dv\d+:/, ""),
      propositionIds: reply.trace.matchedExampleIds.filter((id) => id.startsWith("proposition:") || id.startsWith("fact:")),
      proof: [...(reply.trace.proof ?? [])],
      goal: goalFor(reply),
      source: reply.trace.source,
    });
    if (this.turns.length > 32) this.turns.splice(0, this.turns.length - 32);
  }

  proofReply(input: string): LexiReply | undefined {
    if (!/^(?:how do you know|what supports that|show your proof)$/.test(dv10Normalize(input))) return undefined;
    const last = this.turns.at(-1);
    if (!last) return undefined;
    const proof = last.proof.length ? last.proof : ["No explicit proof steps were attached to the previous answer."];
    return {
      text: proof.map((step, index) => `${index + 1}. ${step}`).join(" "),
      trace: {
        normalizedInput: dv10Normalize(input),
        sentenceMode: "interrogative",
        interpretedIntent: "dv10:proof",
        confidence: 1,
        matchedExampleIds: last.propositionIds,
        matchedTerms: ["dialogue:last-proposition", `goal:${last.goal}`],
        selectedStructure: "dv10-dialogue:proof",
        source: "semantic-runtime",
        subjectIds: last.subjectTexts,
        proof,
      },
    };
  }

  expandFollowUp(input: string) {
    const normalized = dv10Normalize(input);
    const last = this.turns.at(-1);
    const whatAbout = normalized.match(/^what about (.+)$/)?.[1];
    if (whatAbout && last?.relation) {
      if (last.relation.includes("interesting_fact")) return `Tell me something interesting about ${whatAbout}`;
      if (last.relation.includes("definition")) return `What is ${whatAbout}`;
    }
    const correction = normalized.match(/^(?:no |actually )?(?:i meant|in the context of) (.+)$/)?.[1];
    if (correction && this.activeLexicalTerm) {
      return `What does ${this.activeLexicalTerm} mean in ${correction}`;
    }
    return undefined;
  }

  setLexical(term: string, context?: string) {
    this.activeLexicalTerm = term;
    this.activeLexicalContext = context;
  }

  snapshot(): Dv10DialogueSnapshot {
    const last = this.turns.at(-1);
    return {
      turns: this.turns.map((turn) => ({ ...turn, subjectTexts: [...turn.subjectTexts], propositionIds: [...turn.propositionIds], proof: [...turn.proof] })),
      activeSubjects: [...(last?.subjectTexts ?? [])],
      activeRelation: last?.relation,
      activeLexicalTerm: this.activeLexicalTerm,
      activeLexicalContext: this.activeLexicalContext,
      pendingGoal: last?.goal,
    };
  }
}
