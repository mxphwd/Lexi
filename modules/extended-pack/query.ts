import { prepareLinguisticInput, type AnswerStyle } from "./linguistic-features";
import { comparisonFrames, singleSubjectFrames } from "./question-frames";
import type { PackFocus } from "./types";

export type ParsedPackQuery = {
  focus: PackFocus;
  target: string;
  secondTarget?: string;
  frameId: string;
  style: AnswerStyle;
  normalized: string;
  appliedFeatures: string[];
};

const orderedSingleSubjectFrames = [...singleSubjectFrames].sort((left, right) => {
  if (left.focus === "definition" && right.focus !== "definition") return 1;
  if (right.focus === "definition" && left.focus !== "definition") return -1;
  return 0;
});

export function parsePackQueries(input: string): ParsedPackQuery[] {
  const prepared = prepareLinguisticInput(input);
  const matches: ParsedPackQuery[] = [];

  for (const frame of comparisonFrames) {
    const match = prepared.core.match(frame.pattern);
    if (!match?.[1] || !match[2]) continue;
    matches.push({
      focus: frame.focus,
      target: match[1],
      secondTarget: match[2],
      frameId: frame.id,
      style: prepared.style,
      normalized: prepared.core,
      appliedFeatures: prepared.appliedFeatures,
    });
  }

  for (const frame of orderedSingleSubjectFrames) {
    const target = prepared.core.match(frame.pattern)?.[1];
    if (!target) continue;
    matches.push({
      focus: frame.focus,
      target,
      frameId: frame.id,
      style: prepared.style,
      normalized: prepared.core,
      appliedFeatures: prepared.appliedFeatures,
    });
  }

  return matches;
}

export function parsePackQuery(input: string): ParsedPackQuery | undefined {
  return parsePackQueries(input)[0];
}
