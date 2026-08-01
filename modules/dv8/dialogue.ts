import type { LexiReply } from "@/lib/lexi/types";
import type { KnowledgeGraph } from "@/modules/knowledge-graph";
import { analyseSentence } from "@/modules/search";
import { dv8Normalize } from "./normalize";
import type { Dv8TurnProposition, QueryPlan } from "./types";

export class Dv8DialogueState {
  private readonly turns: Dv8TurnProposition[] = [];

  record(
    question: string,
    reply: LexiReply,
    plan?: QueryPlan,
  ) {
    const goal: Dv8TurnProposition["goal"] = plan?.operation === "compare"
      ? "compare"
      : plan?.operation === "ask"
        ? "verify"
        : plan?.operation === "select" || plan?.operation === "aggregate"
          ? "find"
          : plan?.operation === "transform"
            ? "transform"
            : "inform";
    this.turns.push({
      subjectIds: [...(reply.trace.subjectIds ?? [])],
      relation: plan?.patterns[0]?.predicate,
      propositionIds: reply.trace.matchedExampleIds
        .filter((id) => id.startsWith("fact:") || id.startsWith("proposition:")),
      question,
      answer: reply.text,
      proof: [...(reply.trace.proof ?? [])],
      goal,
    });
    if (this.turns.length > 24) this.turns.splice(0, this.turns.length - 24);
  }

  activeSubjectIds() {
    for (let index = this.turns.length - 1; index >= 0; index -= 1) {
      if (this.turns[index].subjectIds.length) return this.turns[index].subjectIds.slice(0, 2);
    }
    return [];
  }

  interpret(input: string, graph: KnowledgeGraph): LexiReply | undefined {
    const normalized = dv8Normalize(input);
    const last = this.turns.at(-1);
    if (!last) return undefined;
    const analysis = analyseSentence(input);
    const reply = (text: string, intent: string, proof: string[]): LexiReply => ({
      text,
      trace: {
        normalizedInput: analysis.normalized,
        sentenceMode: analysis.mode,
        interpretedIntent: intent,
        confidence: 1,
        matchedExampleIds: last.propositionIds,
        matchedTerms: ["dialogue proposition", last.goal],
        selectedStructure: `dv8-dialogue:${intent}`,
        source: "language-engine",
        subjectIds: last.subjectIds,
        proof,
      },
    });

    if (/^(?:why|why is that|how do you know|what supports that)$/.test(normalized)) {
      const explanation = last.proof[0] ?? "the immediately preceding recorded proposition";
      return reply(
        `Because ${explanation[0].toLowerCase()}${explanation.slice(1)}`.replace(/\.?$/, "."),
        "dialogue-proof",
        last.proof,
      );
    }
    if (/^(?:say|explain|make|put) (?:that|it) (?:more )?(?:simply|simple|shorter)$/.test(normalized)) {
      const first = last.answer.split(/(?<=[.!?])\s+/)[0];
      return reply(first, "dialogue-simplify", ["Reduced the previous answer to its first answer proposition."]);
    }
    if (/^(?:what are we talking about|what is the current subject|which subject do you mean)$/.test(normalized)) {
      const names = last.subjectIds.map((id) => graph.entity(id)?.name ?? id);
      return reply(
        names.length ? `The active ${names.length === 1 ? "subject is" : "subjects are"} ${names.join(" and ")}.` : "There is no active factual subject.",
        "dialogue-subject",
        ["Read the active subjects from the most recent proposition-bearing turn."],
      );
    }
    if (/^(?:what was the goal|what were you trying to do)$/.test(normalized)) {
      return reply(`The previous conversational goal was to ${last.goal}.`, "dialogue-goal", ["Read the explicit previous-turn goal."]);
    }
    return undefined;
  }

  snapshot() {
    return this.turns.map((turn) => ({ ...turn, subjectIds: [...turn.subjectIds], propositionIds: [...turn.propositionIds], proof: [...turn.proof] }));
  }
}
