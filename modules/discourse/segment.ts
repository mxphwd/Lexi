const MAX_CLAUSES = 4;

const coordinatedRequestBoundary =
  /\s*(?:(?:,\s*)?(?:and then|and|also|then)|,)\s+(?=(?:please\s+)?(?:tell|explain|define|describe|show|give|help|what|who|where|when|why|how|can|could|would|do|does|did|is|are|will|should|may)\b)/gi;

function splitSentences(input: string): string[] {
  const sentences: string[] = [];
  let buffer = "";

  const flush = () => {
    const sentence = buffer.trim();
    if (sentence) sentences.push(sentence);
    buffer = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const decimalPoint =
      character === "." && /\d/.test(input[index - 1] ?? "") && /\d/.test(input[index + 1] ?? "");

    if (character === "\n" || character === ";" || (/[.!?]/.test(character) && !decimalPoint)) {
      flush();
    } else {
      buffer += character;
    }
  }

  flush();
  return sentences;
}

export function splitIntoClauses(input: string): string[] {
  const clauses = splitSentences(input)
    .flatMap((sentence) => sentence.split(coordinatedRequestBoundary))
    .map((clause) => clause.replace(/^\s*(?:and then|and|also|then)\s+/i, "").trim())
    .filter(Boolean);

  if (clauses.length <= MAX_CLAUSES) return clauses;

  return [
    ...clauses.slice(0, MAX_CLAUSES - 1),
    clauses.slice(MAX_CLAUSES - 1).join("; "),
  ];
}
