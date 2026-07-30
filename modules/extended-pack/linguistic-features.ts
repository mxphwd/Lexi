import { normalizeText } from "@/modules/search/tokenize";
import {
  dv6LinguisticFeatureCount,
  prepareDv6Framing,
  prepareDv6LinguisticInput,
} from "./dv6-linguistic-features";

export type AnswerStyle =
  | "plain"
  | "brief"
  | "simple"
  | "detailed"
  | "exampled"
  | "stepwise"
  | "technical"
  | "practical"
  | "analogy"
  | "balanced";

export type LinguisticPreparation = {
  originalNormalized: string;
  core: string;
  style: AnswerStyle;
  appliedFeatures: string[];
};

type RewriteFeature = {
  id: string;
  pattern: RegExp;
  replacement: string;
};

const leadingFeatures: RewriteFeature[] = [
  { id: "lead-well", pattern: /^well\s+/, replacement: "" },
  { id: "lead-so", pattern: /^so\s+/, replacement: "" },
  { id: "lead-okay", pattern: /^(?:okay|ok)\s+/, replacement: "" },
  { id: "lead-alright", pattern: /^all\s+right\s+/, replacement: "" },
  { id: "lead-now", pattern: /^now\s+/, replacement: "" },
  { id: "lead-then", pattern: /^then\s+/, replacement: "" },
  { id: "lead-actually", pattern: /^actually\s+/, replacement: "" },
  { id: "lead-basically", pattern: /^basically\s+/, replacement: "" },
  { id: "lead-honestly", pattern: /^honestly\s+/, replacement: "" },
  { id: "lead-right", pattern: /^right\s+/, replacement: "" },
  { id: "lead-first", pattern: /^first\s+/, replacement: "" },
  { id: "lead-quick-question", pattern: /^quick\s+question\s+/, replacement: "" },
  { id: "lead-question", pattern: /^i\s+have\s+a\s+question\s+/, replacement: "" },
  { id: "lead-curious", pattern: /^out\s+of\s+curiosity\s+/, replacement: "" },
];

const indirectFeatures: RewriteFeature[] = [
  {
    id: "indirect-wonder-could",
    pattern: /^i\s+was\s+wondering\s+if\s+you\s+could\s+(.+)$/,
    replacement: "$1",
  },
  {
    id: "indirect-wonder-would",
    pattern: /^i\s+was\s+wondering\s+whether\s+you\s+would\s+(.+)$/,
    replacement: "$1",
  },
  {
    id: "indirect-appreciate",
    pattern: /^i\s+would\s+appreciate\s+it\s+if\s+you\s+could\s+(.+)$/,
    replacement: "$1",
  },
  {
    id: "indirect-could-ask",
    pattern: /^could\s+i\s+ask\s+you\s+to\s+(.+)$/,
    replacement: "$1",
  },
  {
    id: "indirect-may-ask",
    pattern: /^may\s+i\s+ask\s+you\s+to\s+(.+)$/,
    replacement: "$1",
  },
  {
    id: "indirect-would-mind-explain",
    pattern: /^would\s+you\s+mind\s+(?:explaining|describing)\s+(.+)$/,
    replacement: "explain $1",
  },
  {
    id: "indirect-do-mind-explain",
    pattern: /^do\s+you\s+mind\s+(?:explaining|describing)\s+(.+)$/,
    replacement: "explain $1",
  },
  {
    id: "indirect-need-you",
    pattern: /^i\s+need\s+you\s+to\s+(.+)$/,
    replacement: "$1",
  },
  {
    id: "indirect-need-help",
    pattern: /^i\s+need\s+help\s+understanding\s+(.+)$/,
    replacement: "help me understand $1",
  },
  {
    id: "indirect-do-not-understand",
    pattern: /^i\s+do\s+not\s+understand\s+(.+)$/,
    replacement: "explain $1",
  },
  {
    id: "indirect-not-sure",
    pattern: /^i\s+am\s+not\s+sure\s+what\s+(.+?)\s+is$/,
    replacement: "what is $1",
  },
  {
    id: "indirect-happen-know",
    pattern: /^do\s+you\s+happen\s+to\s+know\s+what\s+(.+?)\s+is$/,
    replacement: "what is $1",
  },
  {
    id: "indirect-can-help",
    pattern: /^can\s+you\s+help\s+me\s+understand\s+(.+)$/,
    replacement: "help me understand $1",
  },
  {
    id: "indirect-could-help",
    pattern: /^could\s+you\s+help\s+me\s+understand\s+(.+)$/,
    replacement: "help me understand $1",
  },
  {
    id: "indirect-would-help",
    pattern: /^would\s+you\s+help\s+me\s+understand\s+(.+)$/,
    replacement: "help me understand $1",
  },
  {
    id: "indirect-curious-about",
    pattern: /^i\s+am\s+curious\s+about\s+(.+)$/,
    replacement: "tell me about $1",
  },
  {
    id: "indirect-interested-in",
    pattern: /^i\s+am\s+interested\s+in\s+learning\s+about\s+(.+)$/,
    replacement: "tell me about $1",
  },
  {
    id: "indirect-no-idea",
    pattern: /^i\s+have\s+no\s+idea\s+what\s+(.+?)\s+is$/,
    replacement: "what is $1",
  },
];

const trailingFeatures: RewriteFeature[] = [
  { id: "trail-please", pattern: /\s+please$/, replacement: "" },
  { id: "trail-if-possible", pattern: /\s+if\s+possible$/, replacement: "" },
  { id: "trail-when-can", pattern: /\s+when\s+you\s+can$/, replacement: "" },
  { id: "trail-if-mind", pattern: /\s+if\s+you\s+do\s+not\s+mind$/, replacement: "" },
  { id: "trail-for-me", pattern: /\s+for\s+me$/, replacement: "" },
  { id: "trail-thanks", pattern: /\s+(?:thanks|thank\s+you)$/, replacement: "" },
  { id: "trail-right-now", pattern: /\s+right\s+now$/, replacement: "" },
  { id: "trail-a-bit", pattern: /\s+a\s+bit$/, replacement: "" },
];

const styleFeatures: Array<{
  id: string;
  style: Exclude<AnswerStyle, "plain">;
  pattern: RegExp;
}> = [
  { id: "style-brief-briefly", style: "brief", pattern: /\bbriefly\b/ },
  { id: "style-brief-short", style: "brief", pattern: /\b(?:a\s+)?short\s+answer\b/ },
  { id: "style-brief-one-sentence", style: "brief", pattern: /\bin\s+one\s+sentence\b/ },
  { id: "style-brief-concise", style: "brief", pattern: /\bconcisely\b/ },
  { id: "style-simple-terms", style: "simple", pattern: /\bin\s+simple\s+terms\b/ },
  { id: "style-simple-words", style: "simple", pattern: /\busing\s+simple\s+words\b/ },
  { id: "style-simple-plain", style: "simple", pattern: /\bin\s+plain\s+english\b/ },
  { id: "style-simple-beginner", style: "simple", pattern: /\bfor\s+a\s+beginner\b/ },
  { id: "style-simple-easy", style: "simple", pattern: /\bin\s+an\s+easy\s+way\b/ },
  { id: "style-simple-jargon", style: "simple", pattern: /\bwithout\s+jargon\b/ },
  { id: "style-detailed-detail", style: "detailed", pattern: /\bin\s+detail\b/ },
  { id: "style-detailed-thorough", style: "detailed", pattern: /\bthoroughly\b/ },
  { id: "style-detailed-more", style: "detailed", pattern: /\bwith\s+more\s+detail\b/ },
  { id: "style-detailed-full", style: "detailed", pattern: /\b(?:a\s+)?full\s+explanation\b/ },
  { id: "style-example-with", style: "exampled", pattern: /\bwith\s+an\s+example\b/ },
  { id: "style-example-include", style: "exampled", pattern: /\band\s+include\s+an\s+example\b/ },
  { id: "style-example-use", style: "exampled", pattern: /\busing\s+an\s+example\b/ },
];

function applyFirst(value: string, features: RewriteFeature[], applied: string[]): string {
  for (const feature of features) {
    if (!feature.pattern.test(value)) continue;
    applied.push(feature.id);
    return value.replace(feature.pattern, feature.replacement).trim();
  }
  return value;
}

function prepareFraming(
  normalized: string,
  appliedFeatures: string[],
): string {
  let core = normalized;
  core = applyFirst(core, leadingFeatures, appliedFeatures);
  core = applyFirst(core, indirectFeatures, appliedFeatures);
  core = applyFirst(core, trailingFeatures, appliedFeatures);

  if (/^(?:please|kindly)\s+/.test(core)) {
    core = core.replace(/^(?:please|kindly)\s+/, "").trim();
    appliedFeatures.push("lead-courtesy");
  }
  return core;
}

export function prepareDiscourseInput(input: string): LinguisticPreparation {
  const originalNormalized = normalizeText(input);
  const appliedFeatures: string[] = [];
  const core = prepareDv6Framing(
    prepareFraming(originalNormalized, appliedFeatures),
    appliedFeatures,
  );
  return {
    originalNormalized,
    core,
    style: "plain",
    appliedFeatures,
  };
}

export function prepareLinguisticInput(input: string): LinguisticPreparation {
  const originalNormalized = normalizeText(input);
  const appliedFeatures: string[] = [];
  let core = prepareFraming(originalNormalized, appliedFeatures);
  let style: AnswerStyle = "plain";

  for (const feature of styleFeatures) {
    if (!feature.pattern.test(core)) continue;
    if (style === "plain" || feature.style === "detailed" || feature.style === "exampled") {
      style = feature.style;
    }
    core = core
      .replace(feature.pattern, " ")
      .replace(/\s+(?:and|but)\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    appliedFeatures.push(feature.id);
  }

  const dv6 = prepareDv6LinguisticInput(core, style, appliedFeatures);
  core = dv6.core;
  style = dv6.style;

  return { originalNormalized, core, style, appliedFeatures };
}

export const linguisticRewriteFeatureCount =
  leadingFeatures.length +
  indirectFeatures.length +
  trailingFeatures.length +
  styleFeatures.length +
  1 +
  dv6LinguisticFeatureCount;
