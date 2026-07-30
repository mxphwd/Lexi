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
  if (
    /^(?:what\s+is\s+)?(?:the\s+)?difference\s+between\b/i.test(clause) ||
    /^(?:please\s+)?(?:compare|contrast)\b/i.test(clause)
  ) {
    return [clause];
  }

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

function explicitRequestSubject(clause: string): string | undefined {
  const patterns = [
    /^(?:what\s+(?:is|are)|what['’]s)\s+(.+)$/i,
    /^(?:please\s+)?(?:define|describe|explain)\s+(.+)$/i,
    /^(?:(?:can|could|would|will)\s+you\s+)(?:define|describe|explain)\s+(.+)$/i,
    /^(?:please\s+)?tell\s+me\s+about\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const subject = clause.match(pattern)?.[1]?.trim();
    if (subject && !/^(?:how|why|what|who|where|when)\b/i.test(subject)) {
      return subject;
    }
  }
  return undefined;
}

function inheritFollowUpSubjects(clauses: string[]): string[] {
  let activeSubject: string | undefined;

  return clauses.map((clause) => {
    if (activeSubject) {
      const replacements: Array<[RegExp, string]> = [
        [/^why\s+is\s+it\s+important$/i, `Why is ${activeSubject} important`],
        [/^why\s+does\s+it\s+matter$/i, `Why does ${activeSubject} matter`],
        [/^(?:explain|describe)\s+why\s+it\s+is\s+important$/i, `Explain why ${activeSubject} is important`],
        [/^how\s+does\s+it\s+work$/i, `How does ${activeSubject} work`],
        [/^(?:explain|describe)\s+how\s+it\s+works$/i, `Explain how ${activeSubject} works`],
        [/^what\s+is\s+it\s+(?:used\s+)?for$/i, `What is ${activeSubject} used for`],
        [/^(?:give|show)\s+me\s+(?:a|an|one)\s+example(?:\s+of\s+it)?$/i, `Give me an example of ${activeSubject}`],
        [/^what\s+are\s+its\s+(?:parts|components|elements)$/i, `What are the parts of ${activeSubject}`],
        [/^what\s+is\s+it\s+related\s+to$/i, `What is ${activeSubject} related to`],
      ];

      const replacement = replacements.find(([pattern]) => pattern.test(clause));
      if (replacement) return replacement[1];
    }

    activeSubject = explicitRequestSubject(clause) ?? activeSubject;
    return clause;
  });
}

export function splitIntoClauses(input: string): string[] {
  const clauses = inheritFollowUpSubjects(
    splitSentences(input)
    .flatMap((sentence) => sentence.split(coordinatedRequestBoundary))
    .map((clause) => clause.replace(/^\s*(?:and then|and|also|then)\s+/i, "").trim())
    .filter(Boolean)
    .flatMap(inheritSharedRequestFrame),
  );

  if (clauses.length <= MAX_CLAUSES) return clauses;

  return [
    ...clauses.slice(0, MAX_CLAUSES - 1),
    clauses.slice(MAX_CLAUSES - 1).join("; "),
  ];
}
