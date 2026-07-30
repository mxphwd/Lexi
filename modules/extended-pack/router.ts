import { normalizeText } from "@/modules/search/tokenize";
import { matchExtendedConversation } from "./conversation";
import { prepareLinguisticInput, type AnswerStyle } from "./linguistic-features";
import { parsePackQueries } from "./query";
import { matchDeterministicReasoning } from "./reasoning";
import { prepareSemanticTarget } from "./semantic-routing";
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

function cleanTarget(value: string): string {
  return value
    .replace(/^(?:a|an|the)\s+/, "")
    .replace(/\s+(?:please|again)$/, "")
    .replace(/^(?:concept|idea|topic)\s+of\s+/, "")
    .replace(/(?:'s|s')\s+(?:meaning|purpose|importance)$/, "")
    .trim();
}

type TopicMatch = {
  topic: KnowledgeTopic;
  appliedFeatures: string[];
};

function findTopic(value: string): TopicMatch | undefined {
  const semantic = prepareSemanticTarget(cleanTarget(value));
  const target = semantic.target;
  const direct = topicByAlias.get(target);
  if (direct) return { topic: direct, appliedFeatures: semantic.appliedFeatures };

  const inflected =
    target.endsWith("ies")
      ? topicByAlias.get(`${target.slice(0, -3)}y`)
      : target.endsWith("es")
        ? topicByAlias.get(target.slice(0, -2))
        : target.endsWith("s")
          ? topicByAlias.get(target.slice(0, -1))
          : undefined;
  if (inflected) {
    return {
      topic: inflected,
      appliedFeatures: [...semantic.appliedFeatures, "semantic-number-normalization"],
    };
  }
  return undefined;
}

function sentence(value: string): string {
  const trimmed = value.trim().replace(/[.!?]+$/, "");
  return `${trimmed}.`;
}

function capitalize(value: string): string {
  return value ? value[0].toLocaleUpperCase("en-US") + value.slice(1) : value;
}

function unarticledTerm(topic: KnowledgeTopic): string {
  return topic.term.replace(/^(?:a|an|the)\s+/i, "");
}

function baseTopicText(topic: KnowledgeTopic, focus: PackFocus): string {
  switch (focus) {
    case "purpose":
      return `${topic.term} is used to ${topic.purpose}`;
    case "mechanism":
      return topic.mechanism
        ? `at a basic level, ${topic.mechanism}`
        : `${topic.term} works by organizing ideas and actions around its basic purpose: to ${topic.purpose}`;
    case "importance":
      return `${topic.term} matters because ${topic.importance}`;
    case "example":
      return `an example of ${topic.term} is ${topic.example}`;
    case "components":
      return topic.components?.length
        ? `the main parts of ${topic.term} include ${topic.components.join(", ")}`
        : `${topic.term} does not have one fixed parts list in this pack; its closest related concepts are ${topic.related.join(", ")}`;
    case "related":
      return `${topic.term} is closely related to ${topic.related.join(", ")}`;
    case "summary":
      return `${topic.term} is ${topic.definition}. Its main purpose is to ${topic.purpose}. It matters because ${topic.importance}`;
    case "learning": {
      const foundations = topic.components?.slice(0, 3) ?? topic.related.slice(0, 3);
      return `to learn ${unarticledTerm(topic)}, start with ${foundations.join(", ")}. Then connect those basics to ${topic.related.slice(0, 3).join(", ")}, and test your understanding through ${topic.example}`;
    }
    default:
      return `${topic.term} is ${topic.definition}`;
  }
}

function applyAnswerStyle(
  base: string,
  topic: KnowledgeTopic,
  focus: PackFocus,
  style: AnswerStyle,
): string {
  const direct = sentence(capitalize(base));
  if (style === "plain" || style === "brief") return direct;

  if (style === "simple") {
    return `In simple terms, ${direct[0].toLocaleLowerCase("en-US")}${direct.slice(1)}`;
  }

  if (style === "exampled") {
    if (focus === "example") return direct;
    return `${direct} ${sentence(`For example, ${topic.example}`)}`;
  }

  if (style === "practical") {
    return `${direct} ${sentence(`In practice, ${topic.example}`)}`;
  }

  if (style === "analogy") {
    return `${direct} ${sentence(
      `A concrete way to picture the idea is through this recorded example: ${topic.example}`,
    )}`;
  }

  if (style === "stepwise") {
    return [
      `First, ${sentence(`${topic.term} is ${topic.definition}`)}`,
      `Second, ${sentence(topic.mechanism ?? `it serves to ${topic.purpose}`)}`,
      `Finally, ${sentence(`connect it to ${topic.example}`)}`,
    ].join(" ");
  }

  if (style === "technical") {
    const components = topic.components?.length
      ? sentence(`Its principal elements are ${topic.components.join(", ")}`)
      : "";
    return [
      direct,
      topic.mechanism ? sentence(`Mechanically, ${topic.mechanism}`) : "",
      components,
      sentence(`Related concepts include ${topic.related.join(", ")}`),
    ].filter(Boolean).join(" ");
  }

  if (style === "balanced") {
    return [
      direct,
      sentence(`Its central value is that ${topic.importance}`),
      "This is a bounded overview; specialized cases can introduce constraints that are not recorded in this basic knowledge entry.",
    ].join(" ");
  }

  if (focus === "summary") return direct;
  const mechanism = topic.mechanism
    ? sentence(`At a basic level, it works through ${topic.mechanism}`)
    : "";
  return [
    direct,
    sentence(`Its main purpose is to ${topic.purpose}`),
    mechanism,
    sentence(`It matters because ${topic.importance}`),
  ].filter(Boolean).join(" ");
}

function topicResponse(
  topic: KnowledgeTopic,
  focus: PackFocus,
  style: AnswerStyle,
  frameId: string,
  appliedFeatures: string[],
): PackResponse {
  return {
    text: applyAnswerStyle(baseTopicText(topic, focus), topic, focus, style),
    intent: focus,
    recordIds: [`knowledge:${topic.id}`],
    evidence: [...new Set([
      topic.term,
      topic.category,
      focus,
      `frame:${frameId}`,
      ...appliedFeatures.map((feature) => `feature:${feature}`),
    ])],
    structureId: `extended-knowledge:${focus}:${style}`,
    confidence: 1,
  };
}

function topicsExplicitlyRelated(left: KnowledgeTopic, right: KnowledgeTopic): boolean {
  const leftRelations = new Set(left.related.map(normalizeText));
  const rightNames = [right.term, ...right.aliases].map(normalizeText);
  const rightRelations = new Set(right.related.map(normalizeText));
  const leftNames = [left.term, ...left.aliases].map(normalizeText);
  return (
    rightNames.some((name) => leftRelations.has(name)) ||
    leftNames.some((name) => rightRelations.has(name))
  );
}

function comparisonResponse(
  left: KnowledgeTopic,
  right: KnowledgeTopic,
  focus: "comparison" | "similarity",
  style: AnswerStyle,
  frameId: string,
  appliedFeatures: string[],
): PackResponse {
  const leftLabel = capitalize(left.term);
  let text: string;

  if (focus === "similarity") {
    if (topicsExplicitlyRelated(left, right)) {
      text = `${leftLabel} and ${right.term} are directly related concepts. ${leftLabel} is ${left.definition}, while ${right.term} is ${right.definition}.`;
    } else if (left.category === right.category) {
      text = `${leftLabel} and ${right.term} both belong to the same broad subject area. ${leftLabel} is ${left.definition}, while ${right.term} is ${right.definition}.`;
    } else {
      text = `This pack records no direct relationship between ${left.term} and ${right.term}. ${leftLabel} is ${left.definition}, while ${right.term} is ${right.definition}.`;
    }
  } else {
    text = `${leftLabel} is ${left.definition}, whereas ${right.term} is ${right.definition}.`;
  }

  if (style === "detailed") {
    text += ` ${leftLabel} is used to ${left.purpose}; ${right.term} is used to ${right.purpose}.`;
  }

  return {
    text,
    intent: focus,
    recordIds: [`knowledge:${left.id}`, `knowledge:${right.id}`],
    evidence: [...new Set([
      left.term,
      right.term,
      focus,
      `frame:${frameId}`,
      ...appliedFeatures.map((feature) => `feature:${feature}`),
    ])],
    structureId: `extended-knowledge:${focus}:${style}`,
    confidence: 1,
  };
}

export function matchExtendedPack(input: string): PackResponse | undefined {
  const prepared = prepareLinguisticInput(input);
  if (!prepared.core) return undefined;

  const reasoning = matchDeterministicReasoning(prepared.core);
  if (reasoning) {
    return {
      ...reasoning,
      evidence: [
        ...reasoning.evidence,
        ...prepared.appliedFeatures.map((feature) => `feature:${feature}`),
      ],
    };
  }

  const conversation = matchExtendedConversation(prepared.core);
  if (conversation) {
    return {
      ...conversation,
      evidence: [
        ...conversation.evidence,
        ...prepared.appliedFeatures.map((feature) => `feature:${feature}`),
      ],
    };
  }

  for (const parsed of parsePackQueries(input)) {
    const leftMatch = findTopic(parsed.target);
    if (!leftMatch) continue;
    const left = leftMatch.topic;
    const semanticFeatures = [
      ...parsed.appliedFeatures,
      ...leftMatch.appliedFeatures,
    ];

    if (
      (parsed.focus === "comparison" || parsed.focus === "similarity") &&
      parsed.secondTarget
    ) {
      const rightMatch = findTopic(parsed.secondTarget);
      const right = rightMatch?.topic;
      if (right && left.id !== right.id) {
        return comparisonResponse(
          left,
          right,
          parsed.focus,
          parsed.style,
          parsed.frameId,
          [...semanticFeatures, ...(rightMatch?.appliedFeatures ?? [])],
        );
      }
      continue;
    }

    return topicResponse(
      left,
      parsed.focus,
      parsed.style,
      parsed.frameId,
      semanticFeatures,
    );
  }

  const directTopic = findTopic(prepared.core);
  return directTopic
    ? topicResponse(
        directTopic.topic,
        "definition",
        prepared.style,
        "direct-subject",
        [...prepared.appliedFeatures, ...directTopic.appliedFeatures],
      )
    : undefined;
}

export const extendedAliasCount = topicByAlias.size;
