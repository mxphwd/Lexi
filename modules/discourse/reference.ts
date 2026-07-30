import { parsePackQuery } from "@/modules/extended-pack/query";
import { normalizeText } from "@/modules/search/tokenize";

type Pair = [string, string];

const referenceTerms = new Set([
  "it",
  "this",
  "that",
  "this topic",
  "that topic",
  "this concept",
  "that concept",
  "they",
  "them",
  "both",
]);

const singularReferenceRules: Array<{
  id: string;
  pattern: RegExp;
  build: (subject: string) => string;
}> = [
  { id: "definition-what-it", pattern: /^what is it$/i, build: (s) => `What is ${s}` },
  { id: "definition-what-this", pattern: /^what is this$/i, build: (s) => `What is ${s}` },
  { id: "definition-mean", pattern: /^what does (?:it|that) mean$/i, build: (s) => `What does ${s} mean` },
  { id: "definition-explain-it", pattern: /^explain (?:it|that|this)$/i, build: (s) => `Explain ${s}` },
  { id: "definition-describe-it", pattern: /^describe (?:it|that|this)$/i, build: (s) => `Describe ${s}` },
  { id: "definition-more", pattern: /^tell me more(?: about (?:it|that|this))?$/i, build: (s) => `Tell me about ${s}` },
  { id: "summary-it", pattern: /^summarize (?:it|that|this)$/i, build: (s) => `Summarize ${s}` },
  { id: "summary-overview", pattern: /^give me (?:a|an) (?:summary|overview) of (?:it|that|this)$/i, build: (s) => `Give me a summary of ${s}` },
  { id: "purpose-for", pattern: /^what is (?:it|that|this) (?:used )?for$/i, build: (s) => `What is ${s} used for` },
  { id: "purpose-do", pattern: /^what does (?:it|that|this) do$/i, build: (s) => `What does ${s} do` },
  { id: "purpose-its", pattern: /^what is its purpose$/i, build: (s) => `What is the purpose of ${s}` },
  { id: "purpose-use", pattern: /^why (?:do we|would i) use (?:it|that|this)$/i, build: (s) => `Why do we use ${s}` },
  { id: "purpose-can", pattern: /^what can (?:it|that|this) be used for$/i, build: (s) => `What can ${s} be used for` },
  { id: "purpose-help", pattern: /^what does (?:it|that|this) help with$/i, build: (s) => `What does ${s} help with` },
  { id: "mechanism-work", pattern: /^how does (?:it|that|this) work$/i, build: (s) => `How does ${s} work` },
  { id: "mechanism-exactly", pattern: /^how exactly does (?:it|that|this) work$/i, build: (s) => `How exactly does ${s} work` },
  { id: "mechanism-explain", pattern: /^explain how (?:it|that|this) works$/i, build: (s) => `Explain how ${s} works` },
  { id: "mechanism-made", pattern: /^how is (?:it|that|this) made$/i, build: (s) => `How is ${s} made` },
  { id: "mechanism-process", pattern: /^what is the process behind (?:it|that|this)$/i, build: (s) => `What is the process behind ${s}` },
  { id: "importance-important", pattern: /^why is (?:it|that|this) important$/i, build: (s) => `Why is ${s} important` },
  { id: "importance-matter", pattern: /^why does (?:it|that|this) matter$/i, build: (s) => `Why does ${s} matter` },
  { id: "importance-explain", pattern: /^explain why (?:it|that|this) is important$/i, build: (s) => `Explain why ${s} is important` },
  { id: "importance-care", pattern: /^why should i care about (?:it|that|this)$/i, build: (s) => `Why should I care about ${s}` },
  { id: "importance-makes", pattern: /^what makes (?:it|that|this) important$/i, build: (s) => `What makes ${s} important` },
  { id: "importance-its", pattern: /^what is its importance$/i, build: (s) => `What is the importance of ${s}` },
  { id: "example-give", pattern: /^give me (?:a|an|one) example(?: of (?:it|that|this))?$/i, build: (s) => `Give me an example of ${s}` },
  { id: "example-show", pattern: /^show me (?:a|an|one) example(?: of (?:it|that|this))?$/i, build: (s) => `Show me an example of ${s}` },
  { id: "example-can", pattern: /^(?:can|could) you give me (?:a|an) example(?: of (?:it|that|this))?$/i, build: (s) => `Can you give me an example of ${s}` },
  { id: "example-like", pattern: /^like what$/i, build: (s) => `Give me an example of ${s}` },
  { id: "components-parts", pattern: /^what are its (?:parts|components|elements)$/i, build: (s) => `What are the parts of ${s}` },
  { id: "components-have", pattern: /^what (?:parts|components) does (?:it|that|this) have$/i, build: (s) => `What are the components of ${s}` },
  { id: "components-contain", pattern: /^what does (?:it|that|this) contain$/i, build: (s) => `What does ${s} contain` },
  { id: "components-consist", pattern: /^what does (?:it|that|this) consist of$/i, build: (s) => `What does ${s} consist of` },
  { id: "components-made", pattern: /^what is (?:it|that|this) made of$/i, build: (s) => `What is ${s} made of` },
  { id: "components-break", pattern: /^break (?:it|that|this) down$/i, build: (s) => `Break down ${s}` },
  { id: "related-related", pattern: /^what is (?:it|that|this) related to$/i, build: (s) => `What is ${s} related to` },
  { id: "related-similar", pattern: /^what (?:else )?is similar to (?:it|that|this)$/i, build: (s) => `What concepts are similar to ${s}` },
  { id: "related-connects", pattern: /^what connects to (?:it|that|this)$/i, build: (s) => `What is connected to ${s}` },
  { id: "related-next", pattern: /^what should i learn next$/i, build: (s) => `What should I learn after ${s}` },
  { id: "learning-how", pattern: /^how (?:can|should) i learn (?:it|that|this)$/i, build: (s) => `How can I learn ${s}` },
  { id: "learning-start", pattern: /^where (?:do|should) i start$/i, build: (s) => `Where should I start with ${s}` },
  { id: "learning-study", pattern: /^how should i study (?:it|that|this)$/i, build: (s) => `How should I study ${s}` },
  { id: "dv6-summary-key-points", pattern: /^what are the key points(?: of (?:it|that|this))?$/i, build: (s) => `What are the key points of ${s}` },
  { id: "dv6-summary-overview", pattern: /^give me an overview of (?:it|that|this)$/i, build: (s) => `Give me an overview of ${s}` },
  { id: "dv6-summary-main-idea", pattern: /^what is (?:its|the) main idea$/i, build: (s) => `What is the main idea of ${s}` },
  { id: "dv6-summary-know", pattern: /^what should i know about (?:it|that|this)$/i, build: (s) => `Give me a summary of ${s}` },
  { id: "dv6-definition-clarify", pattern: /^(?:can|could) you clarify (?:it|that|this)$/i, build: (s) => `Can you clarify ${s}` },
  { id: "dv6-definition-unpack", pattern: /^(?:can|could) you unpack (?:it|that|this)$/i, build: (s) => `Can you unpack ${s}` },
  { id: "dv6-style-simple", pattern: /^explain (?:it|that|this) simply$/i, build: (s) => `Explain ${s} in simple terms` },
  { id: "dv6-style-detail", pattern: /^explain (?:it|that|this) in detail$/i, build: (s) => `Explain ${s} in detail` },
  { id: "dv6-style-stepwise", pattern: /^explain (?:it|that|this) step by step$/i, build: (s) => `Explain ${s} step by step` },
  { id: "dv6-style-technical", pattern: /^explain (?:it|that|this) technically$/i, build: (s) => `Explain ${s} technically` },
  { id: "dv6-example-practical", pattern: /^give me a practical example of (?:it|that|this)$/i, build: (s) => `Give me an example of ${s}` },
  { id: "dv6-example-real-world", pattern: /^show me a real world use of (?:it|that|this)$/i, build: (s) => `Show me ${s} in use` },
  { id: "dv6-purpose-uses", pattern: /^what are its uses$/i, build: (s) => `What are the uses of ${s}` },
  { id: "dv6-purpose-where", pattern: /^where is (?:it|that|this) used$/i, build: (s) => `What is ${s} used for` },
  { id: "dv6-purpose-problem", pattern: /^what problem does (?:it|that|this) solve$/i, build: (s) => `What does ${s} help with` },
  { id: "dv6-balanced-benefits", pattern: /^what are its benefits$/i, build: (s) => `Why is ${s} important` },
  { id: "dv6-balanced-limits", pattern: /^what are its limits$/i, build: (s) => `Summarize ${s} with benefits and limits` },
  { id: "dv6-balanced-strengths", pattern: /^what are its strengths and weaknesses$/i, build: (s) => `Summarize ${s} with strengths and weaknesses` },
  { id: "dv6-components-organized", pattern: /^how is (?:it|that|this) organized$/i, build: (s) => `What are the components of ${s}` },
  { id: "dv6-components-elements", pattern: /^what are its main elements$/i, build: (s) => `What are the main elements in ${s}` },
  { id: "dv6-related-depend", pattern: /^what does (?:it|that|this) depend on$/i, build: (s) => `What concepts are related to ${s}` },
  { id: "dv6-related-before", pattern: /^what should i learn before (?:it|that|this)$/i, build: (s) => `What concepts are related to ${s}` },
  { id: "dv6-learning-beginner", pattern: /^how can a beginner start learning (?:it|that|this)$/i, build: (s) => `How can I learn ${s}` },
  { id: "dv6-learning-path", pattern: /^make a learning path for (?:it|that|this)$/i, build: (s) => `How should I study ${s}` },
  { id: "dv6-importance-useful", pattern: /^why is (?:it|that|this) useful$/i, build: (s) => `Why is ${s} important` },
  { id: "dv6-importance-value", pattern: /^what value does (?:it|that|this) provide$/i, build: (s) => `Why does ${s} matter` },
  { id: "dv6-mechanism-operate", pattern: /^how does (?:it|that|this) operate$/i, build: (s) => `How does ${s} operate` },
  { id: "dv6-mechanism-steps", pattern: /^what steps does (?:it|that|this) follow$/i, build: (s) => `What are the steps behind ${s}` },
  { id: "dv6-definition-remind", pattern: /^remind me what (?:it|that|this) is$/i, build: (s) => `What is ${s}` },
  { id: "dv6-definition-topic-more", pattern: /^tell me more about (?:this|that) topic$/i, build: (s) => `Tell me about ${s}` },
];

const pairReferenceRules: Array<{
  id: string;
  pattern: RegExp;
  build: (pair: Pair) => string[];
}> = [
  { id: "pair-different", pattern: /^how are they different$/i, build: ([a, b]) => [`Compare ${a} and ${b}`] },
  { id: "pair-differ", pattern: /^how do they differ$/i, build: ([a, b]) => [`Compare ${a} and ${b}`] },
  { id: "pair-difference", pattern: /^what is the difference between them$/i, build: ([a, b]) => [`What is the difference between ${a} and ${b}`] },
  { id: "pair-compare", pattern: /^compare them$/i, build: ([a, b]) => [`Compare ${a} and ${b}`] },
  { id: "pair-contrast", pattern: /^contrast them$/i, build: ([a, b]) => [`Contrast ${a} and ${b}`] },
  { id: "pair-similar", pattern: /^how are they similar$/i, build: ([a, b]) => [`How similar are ${a} and ${b}`] },
  { id: "pair-common", pattern: /^what do they have in common$/i, build: ([a, b]) => [`What do ${a} and ${b} have in common`] },
  { id: "pair-related", pattern: /^how are they related$/i, build: ([a, b]) => [`How are ${a} and ${b} related`] },
  { id: "pair-important", pattern: /^why are they important$/i, build: ([a, b]) => [`Why is ${a} important`, `Why is ${b} important`] },
  { id: "pair-matter", pattern: /^why do they matter$/i, build: ([a, b]) => [`Why does ${a} matter`, `Why does ${b} matter`] },
  { id: "pair-purpose", pattern: /^what are they (?:used )?for$/i, build: ([a, b]) => [`What is ${a} used for`, `What is ${b} used for`] },
  { id: "pair-do", pattern: /^what do they do$/i, build: ([a, b]) => [`What does ${a} do`, `What does ${b} do`] },
  { id: "pair-example-each", pattern: /^(?:give|show) me an example of each$/i, build: ([a, b]) => [`Give me an example of ${a}`, `Give me an example of ${b}`] },
  { id: "pair-example-both", pattern: /^(?:give|show) me examples of both$/i, build: ([a, b]) => [`Give me an example of ${a}`, `Give me an example of ${b}`] },
  { id: "pair-components", pattern: /^what are their (?:parts|components)$/i, build: ([a, b]) => [`What are the parts of ${a}`, `What are the parts of ${b}`] },
  { id: "pair-learn", pattern: /^how should i learn them$/i, build: ([a, b]) => [`How can I learn ${a}`, `How can I learn ${b}`] },
  { id: "dv6-pair-can-compare", pattern: /^(?:can|could) you compare them$/i, build: ([a, b]) => [`Compare ${a} and ${b}`] },
  { id: "dv6-pair-compare-both", pattern: /^compare both of them$/i, build: ([a, b]) => [`Compare ${a} and ${b}`] },
  { id: "dv6-pair-key-difference", pattern: /^what is their key difference$/i, build: ([a, b]) => [`What is the difference between ${a} and ${b}`] },
  { id: "dv6-pair-main-differences", pattern: /^what are their main differences$/i, build: ([a, b]) => [`What are the differences between ${a} and ${b}`] },
  { id: "dv6-pair-distinguish", pattern: /^what distinguishes them$/i, build: ([a, b]) => [`Distinguish between ${a} and ${b}`] },
  { id: "dv6-pair-contrast-both", pattern: /^contrast both concepts$/i, build: ([a, b]) => [`Contrast ${a} and ${b}`] },
  { id: "dv6-pair-similarities", pattern: /^what similarities do they have$/i, build: ([a, b]) => [`What are the similarities between ${a} and ${b}`] },
  { id: "dv6-pair-common-ground", pattern: /^what is their common ground$/i, build: ([a, b]) => [`What do ${a} and ${b} have in common`] },
  { id: "dv6-pair-share", pattern: /^what do both concepts share$/i, build: ([a, b]) => [`What do ${a} and ${b} have in common`] },
  { id: "dv6-pair-connection", pattern: /^what is the connection between them$/i, build: ([a, b]) => [`How are ${a} and ${b} related`] },
  { id: "dv6-pair-relate", pattern: /^explain how they relate$/i, build: ([a, b]) => [`How are ${a} and ${b} related`] },
  { id: "dv6-pair-example-one", pattern: /^give one example of each$/i, build: ([a, b]) => [`Give me an example of ${a}`, `Give me an example of ${b}`] },
  { id: "dv6-pair-practical-examples", pattern: /^show practical examples of both$/i, build: ([a, b]) => [`Give me an example of ${a}`, `Give me an example of ${b}`] },
  { id: "dv6-pair-purpose-each", pattern: /^what is each one used for$/i, build: ([a, b]) => [`What is ${a} used for`, `What is ${b} used for`] },
  { id: "dv6-pair-role-each", pattern: /^what role does each one have$/i, build: ([a, b]) => [`What is the role of ${a}`, `What is the role of ${b}`] },
  { id: "dv6-pair-value", pattern: /^why is each one valuable$/i, build: ([a, b]) => [`Why is ${a} important`, `Why is ${b} important`] },
  { id: "dv6-pair-relevance", pattern: /^why is each one relevant$/i, build: ([a, b]) => [`Why is ${a} relevant`, `Why is ${b} relevant`] },
  { id: "dv6-pair-elements", pattern: /^what are their main elements$/i, build: ([a, b]) => [`What are the main elements in ${a}`, `What are the main elements in ${b}`] },
  { id: "dv6-pair-made-up", pattern: /^what is each one made up of$/i, build: ([a, b]) => [`What are the parts of ${a}`, `What are the parts of ${b}`] },
  { id: "dv6-pair-study", pattern: /^how can i study both$/i, build: ([a, b]) => [`How should I study ${a}`, `How should I study ${b}`] },
  { id: "dv6-pair-learn-order", pattern: /^which one should i learn first$/i, build: ([a, b]) => [`How can I learn ${a}`, `How can I learn ${b}`] },
  { id: "dv6-pair-summarize", pattern: /^summarize both$/i, build: ([a, b]) => [`Summarize ${a}`, `Summarize ${b}`] },
  { id: "dv6-pair-overview", pattern: /^give me an overview of both$/i, build: ([a, b]) => [`Give me an overview of ${a}`, `Give me an overview of ${b}`] },
  { id: "dv6-pair-define", pattern: /^define both$/i, build: ([a, b]) => [`Define ${a}`, `Define ${b}`] },
  { id: "dv6-pair-explain", pattern: /^explain both concepts$/i, build: ([a, b]) => [`Explain ${a}`, `Explain ${b}`] },
  { id: "dv6-pair-work", pattern: /^how does each one work$/i, build: ([a, b]) => [`How does ${a} work`, `How does ${b} work`] },
  { id: "dv6-pair-process", pattern: /^what process does each use$/i, build: ([a, b]) => [`What is the process behind ${a}`, `What is the process behind ${b}`] },
  { id: "dv6-pair-simple", pattern: /^explain both in simple terms$/i, build: ([a, b]) => [`Explain ${a} in simple terms`, `Explain ${b} in simple terms`] },
  { id: "dv6-pair-detailed", pattern: /^explain both in detail$/i, build: ([a, b]) => [`Explain ${a} in detail`, `Explain ${b} in detail`] },
  { id: "dv6-pair-related-topics", pattern: /^what topics are related to both$/i, build: ([a, b]) => [`What topics are related to ${a}`, `What topics are related to ${b}`] },
];

function isExplicitTarget(target: string): boolean {
  return !referenceTerms.has(target.trim().toLocaleLowerCase("en-US"));
}

export function resolveClauseReferences(clauses: string[]): string[] {
  let activeSubject: string | undefined;
  let activePair: Pair | undefined;
  let explicitSubjectSequence: string[] = [];
  const resolved: string[] = [];

  for (const clause of clauses) {
    const pairRule = activePair
      ? pairReferenceRules.find((rule) => rule.pattern.test(clause))
      : undefined;
    if (pairRule && activePair) {
      resolved.push(...pairRule.build(activePair));
      continue;
    }

    const singularRule = activeSubject
      ? singularReferenceRules.find((rule) => rule.pattern.test(clause))
      : undefined;
    const rewritten = singularRule && activeSubject
      ? singularRule.build(activeSubject)
      : clause;

    const parsed = parsePackQuery(rewritten);
    if (
      parsed?.secondTarget &&
      isExplicitTarget(parsed.target) &&
      isExplicitTarget(parsed.secondTarget)
    ) {
      activePair = [parsed.target, parsed.secondTarget];
      activeSubject = undefined;
      explicitSubjectSequence = [parsed.target, parsed.secondTarget];
    } else if (parsed?.target && isExplicitTarget(parsed.target)) {
      activeSubject = parsed.target;
      if (!singularRule) {
        const previous = explicitSubjectSequence.at(-1);
        if (!previous || previous === parsed.target) {
          explicitSubjectSequence = [parsed.target];
        } else {
          explicitSubjectSequence.push(parsed.target);
        }
        activePair =
          explicitSubjectSequence.length === 2
            ? [explicitSubjectSequence[0], explicitSubjectSequence[1]]
            : undefined;
      }
    }

    resolved.push(rewritten);
  }

  return resolved;
}

export function hasUnresolvedReference(input: string): boolean {
  const normalized = normalizeText(input);
  const containsReference =
    /\b(?:it|this|that|they|them|both|its|their|these|those)\b/.test(normalized);
  if (!containsReference) return false;

  return (
    singularReferenceRules.some((rule) => rule.pattern.test(normalized)) ||
    pairReferenceRules.some((rule) => rule.pattern.test(normalized))
  );
}

export const discourseReferenceFeatureCount =
  singularReferenceRules.length + pairReferenceRules.length;
