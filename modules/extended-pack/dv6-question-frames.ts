import type { QuestionFrame } from "./question-frames";
import type { PackFocus } from "./types";

const modalities = ["can", "could", "would", "will", "may", "might"] as const;

function modalSubjectFrames(
  focus: PackFocus,
  family: string,
  templates: readonly string[],
): QuestionFrame[] {
  return modalities.flatMap((modal) =>
    templates.map((template, index) => ({
      id: `dv6-${focus}-${family}-${modal}-${index + 1}`,
      focus,
      pattern: new RegExp(
        `^${modal}\\s+you\\s+${template.replace("{subject}", "(.+)")}$`,
      ),
    })),
  );
}

function modalComparisonFrames(
  family: string,
  templates: readonly string[],
): QuestionFrame[] {
  return modalities.flatMap((modal) =>
    templates.map((template, index) => ({
      id: `dv6-comparison-${family}-${modal}-${index + 1}`,
      focus: "comparison" as const,
      pattern: new RegExp(
        `^${modal}\\s+you\\s+${template
          .replace("{left}", "(.+?)")
          .replace("{right}", "(.+)")}$`,
      ),
    })),
  );
}

export const dv6SingleSubjectFrames: QuestionFrame[] = [
  ...modalSubjectFrames("definition", "explain", [
    "outline {subject}",
    "clarify {subject}",
    "unpack {subject}",
    "introduce me to {subject}",
    "walk me through {subject}",
    "give me an overview of {subject}",
    "give me the basics of {subject}",
    "describe the idea of {subject}",
  ]),
  ...modalSubjectFrames("purpose", "purpose", [
    "explain the purpose of {subject}",
    "describe the uses of {subject}",
    "outline the role of {subject}",
    "clarify the function of {subject}",
    "tell me what {subject} is used for",
    "show me why people use {subject}",
    "explain what {subject} helps with",
  ]),
  ...modalSubjectFrames("mechanism", "mechanism", [
    "outline how {subject} works",
    "describe how {subject} operates",
    "walk me through how {subject} works",
    "explain the steps behind {subject}",
    "show me the process behind {subject}",
    "clarify how {subject} functions",
    "break down how {subject} works",
  ]),
  ...modalSubjectFrames("importance", "importance", [
    "explain why {subject} matters",
    "describe why {subject} is valuable",
    "outline the importance of {subject}",
    "tell me why {subject} is useful",
    "show me the value of {subject}",
    "clarify why {subject} is relevant",
  ]),
  ...modalSubjectFrames("example", "example", [
    "illustrate {subject} with an example",
    "show me a practical example of {subject}",
    "provide one clear example of {subject}",
    "name a real case of {subject}",
    "demonstrate {subject} through an example",
    "give me a case involving {subject}",
  ]),
  ...modalSubjectFrames("components", "components", [
    "outline the parts of {subject}",
    "describe the components of {subject}",
    "list the main elements of {subject}",
    "break {subject} into parts",
    "show me what makes up {subject}",
    "explain the organization of {subject}",
  ]),
  ...modalSubjectFrames("related", "relations", [
    "outline concepts related to {subject}",
    "show me topics connected to {subject}",
    "name ideas associated with {subject}",
    "explain what is similar to {subject}",
    "tell me what to study after {subject}",
  ]),
  ...modalSubjectFrames("summary", "summary", [
    "summarize the key ideas in {subject}",
    "give me a concise overview of {subject}",
    "outline the main points of {subject}",
    "present the big picture of {subject}",
  ]),
  ...modalSubjectFrames("learning", "learning", [
    "make a beginner plan for learning {subject}",
    "outline how to study {subject}",
    "tell me where to begin with {subject}",
    "give me a learning path for {subject}",
  ]),
];

export const dv6ComparisonFrames: QuestionFrame[] = modalComparisonFrames(
  "contrast",
  [
    "compare {left} with {right}",
    "explain the difference between {left} and {right}",
    "contrast {left} against {right}",
  ],
);

export const dv6QuestionFrameCount =
  dv6SingleSubjectFrames.length + dv6ComparisonFrames.length;
