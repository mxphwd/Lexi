const MAX_CLAUSES = 4;

const coordinatedRequestBoundary =
  /\s*(?:(?:,\s*)?(?:and then|and|also|then)|,)\s+(?=(?:please\s+)?(?:tell|explain|define|describe|show|give|help|what|who|where|when|why|how|can|could|would|do|does|did|is|are|will|should|may)\b)/gi;

const sharedRequestFrames = [
  /^(?<frame>(?:please\s+)?(?:what\s+(?:is|are)|what['’]s|who\s+(?:is|are)|who['’]s))\s+(?<items>.+)$/i,
  /^(?<frame>(?:please\s+)?(?:define|describe|explain))\s+(?<items>.+)$/i,
  /^(?<frame>(?:(?:can|could|would|will)\s+you\s+)(?:define|describe|explain))\s+(?<items>.+)$/i,
  /^(?<frame>(?:please\s+)?tell\s+me\s+about)\s+(?<items>.+)$/i,
  /^(?<frame>(?:please\s+)?give\s+me\s+(?:the\s+)?definitions?\s+(?:of|for))\s+(?<items>.+)$/i,
];

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

function inheritSharedRequestFrame(clause: string): string[] {
  for (const pattern of sharedRequestFrames) {
    const match = clause.match(pattern);
    const frame = match?.groups?.frame?.trim();
    const items = match?.groups?.items?.trim();
    if (!frame || !items) continue;

    const coordinatedItems = items
      .split(/\s+(?:and|as\s+well\s+as)\s+/i)
      .map((item) => item.replace(/^,\s*/, "").trim())
      .filter(Boolean);

    if (coordinatedItems.length > 1) {
      return coordinatedItems.map((item) => `${frame} ${item}`);
    }
  }

  return [clause];
}

export function splitIntoClauses(input: string): string[] {
  const clauses = splitSentences(input)
    .flatMap((sentence) => sentence.split(coordinatedRequestBoundary))
    .map((clause) => clause.replace(/^\s*(?:and then|and|also|then)\s+/i, "").trim())
    .filter(Boolean)
    .flatMap(inheritSharedRequestFrame);

  if (clauses.length <= MAX_CLAUSES) return clauses;

  return [
    ...clauses.slice(0, MAX_CLAUSES - 1),
    clauses.slice(MAX_CLAUSES - 1).join("; "),
  ];
}
