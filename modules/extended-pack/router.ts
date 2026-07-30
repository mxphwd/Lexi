import { normalizeText } from "@/modules/search/tokenize";
import { matchExtendedConversation } from "./conversation";
import { knowledgeTopics } from "./topics";
import type { KnowledgeTopic, PackFocus, PackResponse } from "./types";

const topicByAlias = new Map<string, KnowledgeTopic>();
for (const topic of knowledgeTopics) {
  for (const alias of [topic.term, ...topic.aliases]) {
    const normalized = normalizeText(alias);
    topicByAlias.set(normalized, topic);
    topicByAlias.set(normalized.replace(/^(?:a|an|the)\s+/, ""), topic);
  }
}

const targetSuffixes = [
  " in simple terms",
  " simply",
  " briefly",
  " for a beginner",
  " in an easy way",
  " to me",
];

function cleanTarget(value: string): string {
  let target = value
    .replace(/^(?:a|an|the)\s+/, "")
    .replace(/\s+(?:please|again)$/, "")
    .trim();

  for (const suffix of targetSuffixes) {
    if (target.endsWith(suffix)) target = target.slice(0, -suffix.length).trim();
  }
  return target;
}

function findTopic(value: string): KnowledgeTopic | undefined {
  const target = cleanTarget(value);
  const direct = topicByAlias.get(target);
  if (direct) return direct;

  if (target.endsWith("ies")) return topicByAlias.get(`${target.slice(0, -3)}y`);
  if (target.endsWith("s")) return topicByAlias.get(target.slice(0, -1));
  return undefined;
}

const focusedForms: Array<{ focus: PackFocus; patterns: RegExp[] }> = [
  {
    focus: "purpose",
    patterns: [
      /^what (?:is|are) (.+?) (?:used )?for$/,
      /^what (?:does|do) (.+?) do$/,
      /^what is the (?:purpose|use) of (.+)$/,
      /^why (?:do we|would someone) use (.+)$/,
      /^(?:tell|show) me the (?:purpose|use) of (.+)$/,
    ],
  },
  {
    focus: "mechanism",
    patterns: [
      /^how (?:does|do) (.+?) work$/,
      /^how (?:does|do) (.+?) happen$/,
      /^how (?:is|are) (.+?) made$/,
      /^what is the process behind (.+)$/,
      /^(?:explain|describe) how (.+?) works$/,
      /^(?:can|could|would|will) you (?:please )?(?:explain|describe) how (.+?) works$/,
    ],
  },
  {
    focus: "importance",
    patterns: [
      /^why (?:is|are) (.+?) important$/,
      /^why (?:does|do) (.+?) matter$/,
      /^what is the importance of (.+)$/,
      /^(?:explain|describe) why (.+?) (?:is|are) important$/,
    ],
  },
  {
    focus: "example",
    patterns: [
      /^(?:give|show) me (?:a|an|one) example of (.+)$/,
      /^what (?:is|are) (?:a|an|some) examples? of (.+)$/,
      /^can you give me (?:a|an) example of (.+)$/,
      /^example of (.+)$/,
    ],
  },
  {
    focus: "components",
    patterns: [
      /^what are the (?:parts|components|elements) of (.+)$/,
      /^what (?:does|do) (.+?) consist of$/,
      /^(?:list|name) the (?:parts|components|elements) of (.+)$/,
      /^what is (.+?) made of$/,
    ],
  },
  {
    focus: "related",
    patterns: [
      /^what (?:is|are) (.+?) related to$/,
      /^what concepts are related to (.+)$/,
      /^what goes with (.+)$/,
      /^(?:list|name) topics related to (.+)$/,
    ],
  },
  {
    focus: "definition",
    patterns: [
      /^what (?:is|are) (.+)$/,
      /^what does (.+?) mean$/,
      /^(?:please )?(?:define|describe|explain) (.+)$/,
      /^(?:can|could|would|will) you (?:define|describe|explain) (.+)$/,
      /^(?:please )?tell me about (.+)$/,
      /^i (?:want|would like) to (?:know|learn) about (.+)$/,
      /^help me understand (.+)$/,
      /^give me (?:a )?(?:simple |brief )?(?:explanation|overview) of (.+)$/,
      /^what do you know about (.+)$/,
      /^meaning of (.+)$/,
    ],
  },
];

const comparisonForms = [
  /^what is the difference between (.+?) and (.+)$/,
  /^how (?:is|are) (.+?) different from (.+)$/,
  /^(?:compare|contrast) (.+?) (?:and|with) (.+)$/,
  /^what is similar about (.+?) and (.+)$/,
];

function sentence(value: string): string {
  const trimmed = value.trim().replace(/[.!?]+$/, "");
  return `${trimmed}.`;
}

function topicResponse(topic: KnowledgeTopic, focus: PackFocus): PackResponse {
  let text: string;
  switch (focus) {
    case "purpose":
      text = `${topic.term} is used to ${topic.purpose}`;
      break;
    case "mechanism":
      text = topic.mechanism
        ? `${topic.term} works through ${topic.mechanism}`
        : `${topic.term} works by organizing ideas and actions around its basic purpose: to ${topic.purpose}`;
      break;
    case "importance":
      text = `${topic.term} matters because ${topic.importance}`;
      break;
    case "example":
      text = `An example of ${topic.term} is ${topic.example}`;
      break;
    case "components":
      text = topic.components?.length
        ? `The main parts of ${topic.term} include ${topic.components.join(", ")}`
        : `${topic.term} does not have one fixed parts list in this pack; its closest related concepts are ${topic.related.join(", ")}`;
      break;
    case "related":
      text = `${topic.term} is closely related to ${topic.related.join(", ")}`;
      break;
    default:
      text = `${topic.term} is ${topic.definition}`;
  }

  return {
    text: sentence(text[0].toLocaleUpperCase("en-US") + text.slice(1)),
    intent: focus,
    recordIds: [`knowledge:${topic.id}`],
    evidence: [topic.term, topic.category, focus],
    structureId: `extended-knowledge:${focus}`,
    confidence: 1,
  };
}

function comparisonResponse(
  left: KnowledgeTopic,
  right: KnowledgeTopic,
): PackResponse {
  return {
    text: sentence(
      `${left.term[0].toLocaleUpperCase("en-US") + left.term.slice(1)} is ${left.definition}, whereas ${right.term} is ${right.definition}`,
    ),
    intent: "comparison",
    recordIds: [`knowledge:${left.id}`, `knowledge:${right.id}`],
    evidence: [left.term, right.term, "contrast"],
    structureId: "extended-knowledge:comparison",
    confidence: 1,
  };
}

export function matchExtendedPack(input: string): PackResponse | undefined {
  const normalized = normalizeText(input);
  if (!normalized) return undefined;

  const conversation = matchExtendedConversation(normalized);
  if (conversation) return conversation;

  for (const pattern of comparisonForms) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const left = findTopic(match[1]);
    const right = findTopic(match[2]);
    if (left && right && left.id !== right.id) return comparisonResponse(left, right);
  }

  for (const form of focusedForms) {
    for (const pattern of form.patterns) {
      const target = normalized.match(pattern)?.[1];
      if (!target) continue;
      const topic = findTopic(target);
      if (topic) return topicResponse(topic, form.focus);
    }
  }

  const directTopic = findTopic(normalized);
  return directTopic ? topicResponse(directTopic, "definition") : undefined;
}

export const extendedQuestionFrameCount =
  focusedForms.reduce((sum, form) => sum + form.patterns.length, 0) +
  comparisonForms.length;

export const extendedAliasCount = topicByAlias.size;
