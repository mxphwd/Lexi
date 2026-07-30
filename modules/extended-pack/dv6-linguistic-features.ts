import type { AnswerStyle } from "./linguistic-features";

type RewriteFeature = {
  id: string;
  pattern: RegExp;
  replacement: string;
};

type StyleFeature = {
  id: string;
  style: AnswerStyle;
  pattern: RegExp;
};

const leadingFeatures: RewriteFeature[] = [
  { id: "dv6-lead-to-be-clear", pattern: /^to be clear\s+/, replacement: "" },
  { id: "dv6-lead-just-clear", pattern: /^just to be clear\s+/, replacement: "" },
  { id: "dv6-lead-context", pattern: /^for context\s+/, replacement: "" },
  { id: "dv6-lead-reference", pattern: /^for reference\s+/, replacement: "" },
  { id: "dv6-lead-other-words", pattern: /^in other words\s+/, replacement: "" },
  { id: "dv6-lead-as-quick", pattern: /^as a quick question\s+/, replacement: "" },
  { id: "dv6-lead-one-more", pattern: /^one more question\s+/, replacement: "" },
  { id: "dv6-lead-another", pattern: /^another question\s+/, replacement: "" },
  { id: "dv6-lead-before-continue", pattern: /^before we continue\s+/, replacement: "" },
  { id: "dv6-lead-while-here", pattern: /^while we are here\s+/, replacement: "" },
  { id: "dv6-lead-on-note", pattern: /^on that note\s+/, replacement: "" },
  { id: "dv6-lead-speaking", pattern: /^speaking of that\s+/, replacement: "" },
  { id: "dv6-lead-beginner-view", pattern: /^from a beginner perspective\s+/, replacement: "" },
  { id: "dv6-lead-practical-view", pattern: /^from a practical perspective\s+/, replacement: "" },
  { id: "dv6-lead-technical-view", pattern: /^from a technical perspective\s+/, replacement: "" },
  { id: "dv6-lead-high-level", pattern: /^at a high level\s+/, replacement: "" },
  { id: "dv6-lead-general", pattern: /^in general\s+/, replacement: "" },
  { id: "dv6-lead-generally", pattern: /^generally speaking\s+/, replacement: "" },
  { id: "dv6-lead-simply", pattern: /^simply put\s+/, replacement: "" },
  { id: "dv6-lead-particular", pattern: /^in particular\s+/, replacement: "" },
  { id: "dv6-lead-specific", pattern: /^specifically\s+/, replacement: "" },
  { id: "dv6-lead-more-specific", pattern: /^more specifically\s+/, replacement: "" },
  { id: "dv6-lead-if-understand", pattern: /^if i understand correctly\s+/, replacement: "" },
  { id: "dv6-lead-so-understand", pattern: /^just so i understand\s+/, replacement: "" },
  { id: "dv6-lead-let-ask", pattern: /^let me ask\s+/, replacement: "" },
];

const indirectFeatures: RewriteFeature[] = [
  { id: "dv6-indirect-help-figure", pattern: /^help me figure out what (.+?) is$/, replacement: "what is $1" },
  { id: "dv6-indirect-explain-me", pattern: /^explain to me what (.+?) is$/, replacement: "what is $1" },
  { id: "dv6-indirect-teach-about", pattern: /^teach me about (.+)$/, replacement: "tell me about $1" },
  { id: "dv6-indirect-use-explanation", pattern: /^i could use an explanation of (.+)$/, replacement: "explain $1" },
  { id: "dv6-indirect-looking-overview", pattern: /^i am looking for an overview of (.+)$/, replacement: "give me an overview of $1" },
  { id: "dv6-indirect-want-understanding", pattern: /^i want a better understanding of (.+)$/, replacement: "help me understand $1" },
  { id: "dv6-indirect-need-overview", pattern: /^i need an overview of (.+)$/, replacement: "give me an overview of $1" },
  { id: "dv6-indirect-show-meaning", pattern: /^show me what (.+?) means$/, replacement: "what does $1 mean" },
  { id: "dv6-indirect-talk-through", pattern: /^talk me through (.+)$/, replacement: "walk me through $1" },
  { id: "dv6-indirect-break-subject", pattern: /^break down the idea of (.+)$/, replacement: "explain $1" },
  { id: "dv6-indirect-get-basics", pattern: /^i want to get the basics of (.+)$/, replacement: "give me the basics of $1" },
  { id: "dv6-indirect-learn-basics", pattern: /^i would like to learn the basics of (.+)$/, replacement: "give me the basics of $1" },
  { id: "dv6-indirect-new-to", pattern: /^i am new to (.+)$/, replacement: "tell me about $1" },
  { id: "dv6-indirect-unfamiliar", pattern: /^i am unfamiliar with (.+)$/, replacement: "explain $1" },
  { id: "dv6-indirect-refresh", pattern: /^give me a refresher on (.+)$/, replacement: "give me a summary of $1" },
  { id: "dv6-indirect-remind", pattern: /^remind me what (.+?) is$/, replacement: "what is $1" },
  { id: "dv6-indirect-catch-up", pattern: /^catch me up on (.+)$/, replacement: "give me a summary of $1" },
  { id: "dv6-indirect-walk-basics", pattern: /^walk me through the basics of (.+)$/, replacement: "give me the basics of $1" },
  { id: "dv6-indirect-help-study", pattern: /^help me study (.+)$/, replacement: "how should i study $1" },
  { id: "dv6-indirect-plan-learning", pattern: /^plan how i should learn (.+)$/, replacement: "how should i learn $1" },
  { id: "dv6-indirect-curious-purpose", pattern: /^i am curious what (.+?) is used for$/, replacement: "what is $1 used for" },
  { id: "dv6-indirect-wonder-work", pattern: /^i wonder how (.+?) works$/, replacement: "how does $1 work" },
  { id: "dv6-indirect-wonder-important", pattern: /^i wonder why (.+?) matters$/, replacement: "why does $1 matter" },
  { id: "dv6-indirect-see-example", pattern: /^i would like to see an example of (.+)$/, replacement: "give me an example of $1" },
  { id: "dv6-indirect-compare-help", pattern: /^help me compare (.+?) and (.+)$/, replacement: "compare $1 and $2" },
];

const trailingFeatures: RewriteFeature[] = [
  { id: "dv6-trail-if-can", pattern: /\s+if you can$/, replacement: "" },
  { id: "dv6-trail-if-able", pattern: /\s+if you are able$/, replacement: "" },
  { id: "dv6-trail-would-help", pattern: /\s+that would help$/, replacement: "" },
  { id: "dv6-trail-helpful", pattern: /\s+if that is helpful$/, replacement: "" },
  { id: "dv6-trail-if-makes-sense", pattern: /\s+if that makes sense$/, replacement: "" },
  { id: "dv6-trail-need", pattern: /\s+if needed$/, replacement: "" },
  { id: "dv6-trail-have-time", pattern: /\s+if you have time$/, replacement: "" },
  { id: "dv6-trail-convenient", pattern: /\s+when convenient$/, replacement: "" },
  { id: "dv6-trail-appreciated", pattern: /\s+that would be appreciated$/, replacement: "" },
  { id: "dv6-trail-can-thanks", pattern: /\s+if you can thanks$/, replacement: "" },
  { id: "dv6-trail-thank-advance", pattern: /\s+thank you in advance$/, replacement: "" },
  { id: "dv6-trail-much-appreciated", pattern: /\s+much appreciated$/, replacement: "" },
  { id: "dv6-trail-curious", pattern: /\s+i am curious$/, replacement: "" },
  { id: "dv6-trail-wondering", pattern: /\s+i was wondering$/, replacement: "" },
  { id: "dv6-trail-for-reference", pattern: /\s+for reference$/, replacement: "" },
  { id: "dv6-trail-to-start", pattern: /\s+to start$/, replacement: "" },
  { id: "dv6-trail-for-now", pattern: /\s+for now$/, replacement: "" },
  { id: "dv6-trail-at-first", pattern: /\s+at first$/, replacement: "" },
  { id: "dv6-trail-in-this-case", pattern: /\s+in this case$/, replacement: "" },
  { id: "dv6-trail-where-possible", pattern: /\s+where possible$/, replacement: "" },
];

const styleFeatures: StyleFeature[] = [
  { id: "dv6-style-stepwise-step", style: "stepwise", pattern: /\bstep by step\b/ },
  { id: "dv6-style-stepwise-steps", style: "stepwise", pattern: /\bin clear steps\b/ },
  { id: "dv6-style-stepwise-sequence", style: "stepwise", pattern: /\bas a sequence\b/ },
  { id: "dv6-style-stepwise-one-at-time", style: "stepwise", pattern: /\bone step at a time\b/ },
  { id: "dv6-style-stepwise-ordered", style: "stepwise", pattern: /\bin an ordered way\b/ },
  { id: "dv6-style-stepwise-numbered", style: "stepwise", pattern: /\bas a numbered process\b/ },
  { id: "dv6-style-technical-technically", style: "technical", pattern: /\btechnically\b/ },
  { id: "dv6-style-technical-terms", style: "technical", pattern: /\b(?:using|in) technical terms\b/ },
  { id: "dv6-style-technical-expert", style: "technical", pattern: /\bat an expert level\b/ },
  { id: "dv6-style-technical-precise", style: "technical", pattern: /\bwith technical precision\b/ },
  { id: "dv6-style-technical-formal", style: "technical", pattern: /\bwith formal terminology\b/ },
  { id: "dv6-style-technical-engineering", style: "technical", pattern: /\bwith engineering detail\b/ },
  { id: "dv6-style-practical-terms", style: "practical", pattern: /\bin practical terms\b/ },
  { id: "dv6-style-practical-real-world", style: "practical", pattern: /\bin the real world\b/ },
  { id: "dv6-style-practical-applied", style: "practical", pattern: /\bfrom an applied perspective\b/ },
  { id: "dv6-style-practical-usable", style: "practical", pattern: /\bin a usable way\b/ },
  { id: "dv6-style-practical-use", style: "practical", pattern: /\bwith a practical use\b/ },
  { id: "dv6-style-practical-everyday", style: "practical", pattern: /\bthrough an everyday application\b/ },
  { id: "dv6-style-analogy-with", style: "analogy", pattern: /\bwith an analogy\b/ },
  { id: "dv6-style-analogy-use", style: "analogy", pattern: /\buse an analogy\b/ },
  { id: "dv6-style-analogy-by", style: "analogy", pattern: /\bby analogy\b/ },
  { id: "dv6-style-analogy-familiar", style: "analogy", pattern: /\bcompare it to something familiar\b/ },
  { id: "dv6-style-analogy-metaphor", style: "analogy", pattern: /\bwith a simple metaphor\b/ },
  { id: "dv6-style-analogy-intuitive", style: "analogy", pattern: /\bwith an intuitive comparison\b/ },
  { id: "dv6-style-balanced-limits", style: "balanced", pattern: /\bwith benefits and limits\b/ },
  { id: "dv6-style-balanced-pros", style: "balanced", pattern: /\bwith pros and cons\b/ },
  { id: "dv6-style-balanced-view", style: "balanced", pattern: /\bwith a balanced view\b/ },
  { id: "dv6-style-balanced-strengths", style: "balanced", pattern: /\bwith strengths and weaknesses\b/ },
  { id: "dv6-style-balanced-tradeoffs", style: "balanced", pattern: /\bincluding the trade offs\b/ },
  { id: "dv6-style-balanced-sides", style: "balanced", pattern: /\bshowing both sides\b/ },
];

function applyFirst(
  value: string,
  features: RewriteFeature[],
  appliedFeatures: string[],
): string {
  for (const feature of features) {
    if (!feature.pattern.test(value)) continue;
    appliedFeatures.push(feature.id);
    return value.replace(feature.pattern, feature.replacement).trim();
  }
  return value;
}

export function prepareDv6Framing(
  value: string,
  appliedFeatures: string[],
): string {
  let core = value;
  core = applyFirst(core, leadingFeatures, appliedFeatures);
  core = applyFirst(core, indirectFeatures, appliedFeatures);
  core = applyFirst(core, trailingFeatures, appliedFeatures);
  return core;
}

export function prepareDv6LinguisticInput(
  value: string,
  initialStyle: AnswerStyle,
  appliedFeatures: string[],
): { core: string; style: AnswerStyle } {
  let core = prepareDv6Framing(value, appliedFeatures);
  let style = initialStyle;

  for (const feature of styleFeatures) {
    if (!feature.pattern.test(core)) continue;
    style = feature.style;
    core = core
      .replace(feature.pattern, " ")
      .replace(/\s+(?:and|but|with)\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    appliedFeatures.push(feature.id);
  }

  return { core, style };
}

export const dv6LinguisticFeatureCount =
  leadingFeatures.length +
  indirectFeatures.length +
  trailingFeatures.length +
  styleFeatures.length;
