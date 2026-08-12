import type { LexiReply } from "@/lib/lexi/types";
import { analyseSentence } from "@/modules/search";
import { dv8Normalize } from "@/modules/dv8/normalize";
import type { Dv9DialogueSnapshot, Dv9LexicalOperation, Dv9LexicalPlan } from "./types";

export class Dv9DialogueState {
  private activeTerm?: string;
  private activeSenseIndex = 0;
  private readonly previousTerms: string[] = [];
  private goal?: Dv9DialogueSnapshot["goal"];

  record(plan: Dv9LexicalPlan) {
    if (this.activeTerm && this.activeTerm !== plan.term) {
      this.previousTerms.push(this.activeTerm);
      if (this.previousTerms.length > 12) this.previousTerms.shift();
    }
    this.activeTerm = plan.term;
    if (plan.requestedSense !== undefined) this.activeSenseIndex = plan.requestedSense;
    this.goal = this.goalFor(plan.operation);
  }

  recordSense(index: number) {
    this.activeSenseIndex = Math.max(0, index);
  }

  private goalFor(operation: Dv9LexicalOperation): Dv9DialogueSnapshot["goal"] {
    if (operation === "list-senses") return "disambiguate";
    if (operation === "part-of-speech") return "classify";
    if (operation === "example") return "find-example";
    if (operation === "related") return "relate";
    if (operation === "provenance") return "inspect-source";
    return "define";
  }

  interpret(input: string): LexiReply | undefined {
    const normalized = dv8Normalize(input);
    if (!this.activeTerm) return undefined;
    const analysis = analyseSentence(input);
    const reply = (text: string, intent: string, proof: string[]): LexiReply => ({
      text,
      trace: {
        normalizedInput: analysis.normalized,
        sentenceMode: analysis.mode,
        interpretedIntent: intent,
        confidence: 1,
        matchedExampleIds: [`dv9:dialogue:${this.activeTerm}`],
        matchedTerms: [this.activeTerm!, this.goal ?? "define"],
        selectedStructure: `dv9-dialogue:${intent}`,
        source: "dv9-data-engine",
        proof,
      },
    });
    if (/^(?:what are we discussing|what are we talking about|what is the current lexical subject)$/.test(normalized)) {
      return reply(`The active lexical subject is “${this.activeTerm}”.`, "dialogue-subject", ["Read the active term from DV9 proposition state."]);
    }
    if (/^(?:what is our goal|what are we trying to find)$/.test(normalized)) {
      return reply(`The current goal is to ${this.goal ?? "define"} “${this.activeTerm}”.`, "dialogue-goal", ["Read the explicit DV9 conversational goal."]);
    }
    if (/^(?:go back|return to the previous word|what was the previous term)$/.test(normalized)) {
      const previous = this.previousTerms.pop();
      if (!previous) return reply("There is no earlier lexical subject in this session.", "dialogue-subject", ["The lexical subject stack is empty."]);
      this.activeTerm = previous;
      this.activeSenseIndex = 0;
      return reply(`The active lexical subject is now “${previous}”.`, "dialogue-subject", ["Restored the preceding lexical subject from session state."]);
    }
    return undefined;
  }

  snapshot(): Dv9DialogueSnapshot {
    return {
      activeTerm: this.activeTerm,
      activeSenseIndex: this.activeSenseIndex,
      previousTerms: [...this.previousTerms],
      goal: this.goal,
    };
  }

  restore(snapshot: Dv9DialogueSnapshot) {
    this.activeTerm = snapshot.activeTerm;
    this.activeSenseIndex = snapshot.activeSenseIndex;
    this.previousTerms.splice(0, this.previousTerms.length, ...snapshot.previousTerms);
    this.goal = snapshot.goal;
  }
}
