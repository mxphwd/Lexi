import type { PackResponse } from "./types";

type ReasoningRule = {
  id: string;
  patterns: RegExp[];
  solve: (match: RegExpMatchArray, patternIndex: number) => string | undefined;
  evidence: string[];
};

const NUMBER = "(-?\\d+(?:\\.\\d+)?)";

function number(value: string): number {
  return Number.parseFloat(value);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "undefined";
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return Number(value.toPrecision(10)).toLocaleString("en-US", {
    maximumFractionDigits: 10,
  });
}

function numbersIn(value: string): number[] {
  return [...value.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => number(match[0]));
}

function binaryResult(
  label: string,
  operation: (left: number, right: number) => number,
) {
  return (match: RegExpMatchArray) => {
    const left = number(match[1]);
    const right = number(match[2]);
    const result = operation(left, right);
    return `${formatNumber(left)} ${label} ${formatNumber(right)} is ${formatNumber(result)}.`;
  };
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

function singularForm(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (normalized.endsWith("ies")) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("ses")) return normalized.slice(0, -2);
  if (normalized.endsWith("s") && !normalized.endsWith("ss")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function sameClass(left: string, right: string): boolean {
  return singularForm(left) === singularForm(right);
}

function capitalize(value: string): string {
  return value ? value[0].toLocaleUpperCase("en-US") + value.slice(1) : value;
}

const rules: ReasoningRule[] = [
  {
    id: "addition",
    patterns: [
      new RegExp(`^what is ${NUMBER} plus ${NUMBER}$`),
      new RegExp(`^add ${NUMBER} and ${NUMBER}$`),
      new RegExp(`^what do you get when you add ${NUMBER} and ${NUMBER}$`),
      new RegExp(`^find the sum of ${NUMBER} and ${NUMBER}$`),
      new RegExp(`^calculate ${NUMBER} plus ${NUMBER}$`),
      new RegExp(`^how much is ${NUMBER} plus ${NUMBER}$`),
      new RegExp(`^sum ${NUMBER} with ${NUMBER}$`),
      new RegExp(`^combine ${NUMBER} and ${NUMBER} as numbers$`),
    ],
    solve: binaryResult("plus", (left, right) => left + right),
    evidence: ["addition", "two numeric operands"],
  },
  {
    id: "subtraction",
    patterns: [
      new RegExp(`^what is ${NUMBER} minus ${NUMBER}$`),
      new RegExp(`^subtract ${NUMBER} from ${NUMBER}$`),
      new RegExp(`^what do you get when you subtract ${NUMBER} from ${NUMBER}$`),
      new RegExp(`^find the difference between ${NUMBER} and ${NUMBER}$`),
      new RegExp(`^calculate ${NUMBER} minus ${NUMBER}$`),
      new RegExp(`^how much is ${NUMBER} minus ${NUMBER}$`),
      new RegExp(`^take ${NUMBER} away from ${NUMBER}$`),
      new RegExp(`^decrease ${NUMBER} by ${NUMBER}$`),
    ],
    solve: (match, patternIndex) => {
      const reverse = [1, 2, 6].includes(patternIndex);
      const left = number(reverse ? match[2] : match[1]);
      const right = number(reverse ? match[1] : match[2]);
      return `${formatNumber(left)} minus ${formatNumber(right)} is ${formatNumber(left - right)}.`;
    },
    evidence: ["subtraction", "two numeric operands"],
  },
  {
    id: "multiplication",
    patterns: [
      new RegExp(`^what is ${NUMBER} times ${NUMBER}$`),
      new RegExp(`^multiply ${NUMBER} by ${NUMBER}$`),
      new RegExp(`^what do you get when you multiply ${NUMBER} by ${NUMBER}$`),
      new RegExp(`^find the product of ${NUMBER} and ${NUMBER}$`),
      new RegExp(`^calculate ${NUMBER} times ${NUMBER}$`),
      new RegExp(`^how much is ${NUMBER} times ${NUMBER}$`),
      new RegExp(`^scale ${NUMBER} by ${NUMBER}$`),
      new RegExp(`^what is ${NUMBER} multiplied by ${NUMBER}$`),
    ],
    solve: binaryResult("times", (left, right) => left * right),
    evidence: ["multiplication", "two numeric operands"],
  },
  {
    id: "division",
    patterns: [
      new RegExp(`^what is ${NUMBER} divided by ${NUMBER}$`),
      new RegExp(`^divide ${NUMBER} by ${NUMBER}$`),
      new RegExp(`^what do you get when you divide ${NUMBER} by ${NUMBER}$`),
      new RegExp(`^find the quotient of ${NUMBER} and ${NUMBER}$`),
      new RegExp(`^calculate ${NUMBER} divided by ${NUMBER}$`),
      new RegExp(`^how much is ${NUMBER} divided by ${NUMBER}$`),
      new RegExp(`^split ${NUMBER} into ${NUMBER} equal parts$`),
      new RegExp(`^what is the ratio of ${NUMBER} to ${NUMBER} as a quotient$`),
    ],
    solve: (match) => {
      const left = number(match[1]);
      const right = number(match[2]);
      if (right === 0) return "Division by zero is undefined.";
      return `${formatNumber(left)} divided by ${formatNumber(right)} is ${formatNumber(left / right)}.`;
    },
    evidence: ["division", "zero check"],
  },
  {
    id: "percentage",
    patterns: [
      new RegExp(`^what is ${NUMBER} percent of ${NUMBER}$`),
      new RegExp(`^find ${NUMBER} percent of ${NUMBER}$`),
      new RegExp(`^calculate ${NUMBER} percent of ${NUMBER}$`),
      new RegExp(`^how much is ${NUMBER} percent of ${NUMBER}$`),
      new RegExp(`^what percentage of ${NUMBER} is ${NUMBER}$`),
      new RegExp(`^${NUMBER} is what percent of ${NUMBER}$`),
      new RegExp(`^convert ${NUMBER} out of ${NUMBER} to a percentage$`),
      new RegExp(`^express ${NUMBER} as a percentage of ${NUMBER}$`),
    ],
    solve: (match, patternIndex) => {
      const left = number(match[1]);
      const right = number(match[2]);
      if (patternIndex < 4) {
        return `${formatNumber(left)} percent of ${formatNumber(right)} is ${formatNumber((left / 100) * right)}.`;
      }
      if (patternIndex === 4) {
        if (left === 0) return "A percentage relative to zero is undefined.";
        return `${formatNumber(right)} is ${formatNumber((right / left) * 100)} percent of ${formatNumber(left)}.`;
      }
      if (right === 0) return "A percentage relative to zero is undefined.";
      return `${formatNumber(left)} is ${formatNumber((left / right) * 100)} percent of ${formatNumber(right)}.`;
    },
    evidence: ["percentage", "base-value check"],
  },
  {
    id: "average",
    patterns: [
      /^what is the average of ((?:-?\d+(?:\.\d+)?(?: and | )?)+)$/,
      /^find the average of ((?:-?\d+(?:\.\d+)?(?: and | )?)+)$/,
      /^calculate the mean of ((?:-?\d+(?:\.\d+)?(?: and | )?)+)$/,
      /^what is the mean of ((?:-?\d+(?:\.\d+)?(?: and | )?)+)$/,
      /^average these numbers ((?:-?\d+(?:\.\d+)?(?: and | )?)+)$/,
      /^compute the arithmetic mean of ((?:-?\d+(?:\.\d+)?(?: and | )?)+)$/,
    ],
    solve: (match) => {
      const values = numbersIn(match[1]);
      if (values.length === 0) return undefined;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      return `The arithmetic mean of ${values.map(formatNumber).join(", ")} is ${formatNumber(mean)}.`;
    },
    evidence: ["arithmetic mean", "numeric list"],
  },
  {
    id: "ratio",
    patterns: [
      new RegExp(`^simplify the ratio ${NUMBER} to ${NUMBER}$`),
      new RegExp(`^reduce the ratio ${NUMBER} to ${NUMBER}$`),
      new RegExp(`^what is the simplest ratio of ${NUMBER} to ${NUMBER}$`),
      new RegExp(`^write ${NUMBER} to ${NUMBER} as a simplified ratio$`),
      new RegExp(`^simplify ${NUMBER} compared with ${NUMBER} as a ratio$`),
      new RegExp(`^find the reduced ratio between ${NUMBER} and ${NUMBER}$`),
    ],
    solve: (match) => {
      const left = number(match[1]);
      const right = number(match[2]);
      if (!Number.isInteger(left) || !Number.isInteger(right) || right === 0) {
        return "I can simplify this ratio only when both values are integers and the second value is not zero.";
      }
      const divisor = greatestCommonDivisor(left, right);
      return `The simplified ratio of ${formatNumber(left)} to ${formatNumber(right)} is ${formatNumber(left / divisor)}:${formatNumber(right / divisor)}.`;
    },
    evidence: ["integer ratio", "greatest common divisor"],
  },
  {
    id: "comparison",
    patterns: [
      new RegExp(`^which is larger ${NUMBER} or ${NUMBER}$`),
      new RegExp(`^which is greater ${NUMBER} or ${NUMBER}$`),
      new RegExp(`^which number is bigger ${NUMBER} or ${NUMBER}$`),
      new RegExp(`^which is smaller ${NUMBER} or ${NUMBER}$`),
      new RegExp(`^which is less ${NUMBER} or ${NUMBER}$`),
      new RegExp(`^compare the numbers ${NUMBER} and ${NUMBER}$`),
      new RegExp(`^is ${NUMBER} greater than ${NUMBER}$`),
      new RegExp(`^is ${NUMBER} less than ${NUMBER}$`),
    ],
    solve: (match, patternIndex) => {
      const left = number(match[1]);
      const right = number(match[2]);
      if (left === right) return `${formatNumber(left)} and ${formatNumber(right)} are equal.`;
      if (patternIndex === 6) {
        return left > right
          ? `Yes. ${formatNumber(left)} is greater than ${formatNumber(right)}.`
          : `No. ${formatNumber(left)} is not greater than ${formatNumber(right)}.`;
      }
      if (patternIndex === 7) {
        return left < right
          ? `Yes. ${formatNumber(left)} is less than ${formatNumber(right)}.`
          : `No. ${formatNumber(left)} is not less than ${formatNumber(right)}.`;
      }
      const wantsSmaller = [3, 4].includes(patternIndex);
      const result = wantsSmaller ? Math.min(left, right) : Math.max(left, right);
      return `${formatNumber(result)} is the ${wantsSmaller ? "smaller" : "larger"} value.`;
    },
    evidence: ["numeric comparison", "ordered values"],
  },
  {
    id: "ordering",
    patterns: [
      /^sort these numbers from smallest to largest ((?:-?\d+(?:\.\d+)?\s*)+)$/,
      /^put these numbers in ascending order ((?:-?\d+(?:\.\d+)?\s*)+)$/,
      /^order these numbers from low to high ((?:-?\d+(?:\.\d+)?\s*)+)$/,
      /^sort these numbers from largest to smallest ((?:-?\d+(?:\.\d+)?\s*)+)$/,
      /^put these numbers in descending order ((?:-?\d+(?:\.\d+)?\s*)+)$/,
      /^order these numbers from high to low ((?:-?\d+(?:\.\d+)?\s*)+)$/,
    ],
    solve: (match, patternIndex) => {
      const values = numbersIn(match[1]);
      if (values.length < 2) return undefined;
      const descending = patternIndex >= 3;
      const ordered = [...values].sort((left, right) =>
        descending ? right - left : left - right,
      );
      return `The ${descending ? "descending" : "ascending"} order is ${ordered.map(formatNumber).join(", ")}.`;
    },
    evidence: ["numeric ordering", "stable sort direction"],
  },
  {
    id: "sequence",
    patterns: [
      /^what comes next in (-?\d+(?:\s+-?\d+){2,})$/,
      /^find the next number in (-?\d+(?:\s+-?\d+){2,})$/,
      /^continue the sequence (-?\d+(?:\s+-?\d+){2,})$/,
      /^what is the next term of (-?\d+(?:\s+-?\d+){2,})$/,
      /^extend this number pattern (-?\d+(?:\s+-?\d+){2,})$/,
      /^complete the arithmetic sequence (-?\d+(?:\s+-?\d+){2,})$/,
    ],
    solve: (match) => {
      const values = numbersIn(match[1]);
      const difference = values[1] - values[0];
      const arithmetic = values.slice(2).every(
        (value, index) => value - values[index + 1] === difference,
      );
      if (!arithmetic) {
        return "That sequence does not have one constant arithmetic difference, so I will not guess a next term.";
      }
      const next = values.at(-1)! + difference;
      return `The constant difference is ${formatNumber(difference)}, so the next term is ${formatNumber(next)}.`;
    },
    evidence: ["arithmetic sequence", "constant-difference check"],
  },
  {
    id: "text-measurement",
    patterns: [
      /^how many words are in (.+)$/,
      /^count the words in (.+)$/,
      /^what is the word count of (.+)$/,
      /^tell me the number of words in (.+)$/,
      /^how many letters are in (.+)$/,
      /^count the letters in (.+)$/,
      /^what is the letter count of (.+)$/,
      /^tell me the number of letters in (.+)$/,
    ],
    solve: (match, patternIndex) => {
      const value = match[1].trim();
      if (patternIndex < 4) {
        const words = value.match(/[\p{L}\p{N}]+/gu) ?? [];
        return `"${value}" contains ${words.length} ${words.length === 1 ? "word" : "words"}.`;
      }
      const letters = value.match(/\p{L}/gu) ?? [];
      return `"${value}" contains ${letters.length} ${letters.length === 1 ? "letter" : "letters"}.`;
    },
    evidence: ["text measurement", "explicit character classes"],
  },
  {
    id: "logic",
    patterns: [
      /^if all (.+?) are (.+?) and (.+?) is (?:a|an) (.+?) is \3 (?:a|an) (.+)$/,
      /^all (.+?) are (.+?) and (.+?) is (?:a|an) (.+?) does \3 belong to (.+)$/,
      /^if no (.+?) are (.+?) and (.+?) is (?:a|an) (.+?) is \3 (?:a|an) (.+)$/,
      /^no (.+?) are (.+?) and (.+?) is (?:a|an) (.+?) can \3 be (.+)$/,
      /^if (.+?) implies (.+?) and \2 implies (.+?) does \1 imply \3$/,
      /^given that (.+?) leads to (.+?) and \2 leads to (.+?) does \1 lead to \3$/,
      /^if (.+?) then (.+?) and \1 is true what follows$/,
      /^given (.+?) implies (.+?) and \1 holds what can we infer$/,
      /^can (.+?) and not \1 both be true at the same time$/,
      /^is the statement (.+?) and not \1 a contradiction$/,
    ],
    solve: (match, patternIndex) => {
      if (patternIndex < 2) {
        if (!sameClass(match[1], match[4]) || !sameClass(match[2], match[5])) {
          return "The stated category or conclusion does not match the premise terms closely enough for this bounded inference rule.";
        }
        return `Yes. From the stated premises that all ${match[1]} are ${match[2]} and ${capitalize(match[3])} is a ${singularForm(match[4])}, it follows that ${capitalize(match[3])} is a ${singularForm(match[2])}.`;
      }
      if (patternIndex < 4) {
        if (!sameClass(match[1], match[4]) || !sameClass(match[2], match[5])) {
          return "The stated category or conclusion does not match the premise terms closely enough for this bounded inference rule.";
        }
        return `No. From the stated premises that no ${match[1]} are ${match[2]} and ${capitalize(match[3])} is a ${singularForm(match[4])}, it follows that ${capitalize(match[3])} is not a ${singularForm(match[2])}.`;
      }
      if (patternIndex < 6) {
        return `Yes. The two stated implications form a chain from ${match[1]} through ${match[2]} to ${match[3]}.`;
      }
      if (patternIndex < 8) {
        return `From the stated implication and the premise that ${match[1]}, we can infer ${match[2]}.`;
      }
      return `No. Under ordinary two-valued logic, "${match[1]}" and its negation cannot both be true at the same time; that form is a contradiction.`;
    },
    evidence: ["explicit premises", "deductive rule", "no external facts"],
  },
  {
    id: "decision",
    patterns: [
      /^should i choose (.+?) or (.+)$/,
      /^which is better for me (.+?) or (.+)$/,
      /^help me decide between (.+?) and (.+)$/,
      /^compare my options (.+?) and (.+)$/,
      /^how do i choose between (.+?) and (.+)$/,
      /^which option should i pick (.+?) or (.+)$/,
      /^is (.+?) a better choice than (.+)$/,
      /^would (.+?) be better than (.+)$/,
      /^what should decide between (.+?) and (.+)$/,
      /^give me a decision method for (.+?) versus (.+)$/,
    ],
    solve: (match) =>
      `I can compare ${match[1]} and ${match[2]}, but “better” requires a criterion. State the outcome you value, hard constraints, and acceptable risks; then score both options against the same factors.`,
    evidence: ["two options", "criterion required", "no invented preference"],
  },
];

export function matchDeterministicReasoning(
  normalized: string,
): PackResponse | undefined {
  for (const rule of rules) {
    for (let index = 0; index < rule.patterns.length; index += 1) {
      const match = normalized.match(rule.patterns[index]);
      if (!match) continue;
      const text = rule.solve(match, index);
      if (!text) return undefined;
      return {
        text,
        intent: `reasoning:${rule.id}`,
        recordIds: [`reasoning:${rule.id}`],
        evidence: rule.evidence,
        structureId: `dv6-reasoning:${rule.id}`,
        confidence: 1,
      };
    }
  }
  return undefined;
}

export const deterministicReasoningFeatureCount = rules.reduce(
  (sum, rule) => sum + rule.patterns.length,
  0,
);
