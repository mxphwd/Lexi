import { dv10Normalize, dv10Number } from "./normalize";
import type { Dv10QueryPlan, Dv10Relation, Dv10Term } from "./types";

function term(text: string, role: Dv10Term["role"]): Dv10Term {
  return { text: text.trim(), normalized: dv10Normalize(text), role };
}

function plan(
  original: string,
  relation: Dv10Relation,
  operation: Dv10QueryPlan["operation"],
  values: Partial<Dv10QueryPlan> = {},
): Dv10QueryPlan {
  const normalized = dv10Normalize(original);
  return {
    id: `dv10:${operation}:${relation}`,
    original,
    normalized,
    speechAct: /^(?:name|list|give|tell|show|explain|define)\b/.test(normalized) ? "request" : "ask",
    operation,
    relation,
    conditions: [],
    negated: /\b(?:not|never|no|cannot)\b/.test(normalized),
    answerShape: operation === "count" ? "number" : operation === "list" ? "list" : operation === "reason" ? "explanation" : "text",
    confidence: 0.98,
    evidence: [`grammar:${operation}:${relation}`],
    ...values,
  };
}

function arithmeticStory(original: string, normalized: string): Dv10QueryPlan | undefined {
  const expression = normalized.match(
    /(?:i|you|we|[a-z]+)\s+(?:have|has|had|start(?:ed)? with)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+([a-z]+).*?\b(?:buy|bought|get|got|receive|received|add|added|find|found)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(?:more\s+)?(?:[a-z]+)?.*?how many/i,
  );
  if (!expression) return undefined;
  const left = dv10Number(expression[1]);
  const right = dv10Number(expression[3]);
  if (left === undefined || right === undefined) return undefined;
  return plan(original, "arithmetic_result", "reason", {
    subject: term(expression[2], "subject"),
    quantity: left + right,
    conditions: [`start:${left}`, `increase:${right}`],
    answerShape: "number",
    evidence: ["grammar:arithmetic-state-change", `addends:${left},${right}`],
  });
}

export function parseDv10Plan(original: string): Dv10QueryPlan | undefined {
  const normalized = dv10Normalize(original);
  const arithmetic = arithmeticStory(original, normalized);
  if (arithmetic) return arithmetic;

  if (/^how many (?:continents|continent regions)(?: are there| does earth have)?$/.test(normalized)) {
    return plan(original, "count", "count", { subject: term("continents", "subject") });
  }

  const listMatch = normalized.match(/^(?:name|list|give me)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(mammals?|animals?|planets?)$/);
  if (listMatch) {
    return plan(original, "member", "list", {
      subject: term(listMatch[2], "subject"),
      quantity: dv10Number(listMatch[1]),
      answerShape: "list",
    });
  }

  const closest = normalized.match(/^which\s+([a-z -]+?)\s+is\s+(?:the\s+)?closest to\s+(?:the\s+)?(.+)$/);
  if (closest) {
    return plan(original, "closest_to", "lookup", {
      subject: term(closest[1], "subject"),
      object: term(closest[2], "object"),
      answerShape: "entity",
    });
  }

  const distance = normalized.match(/^how far is (?:the )?(.+?) from (?:the )?(.+)$/);
  if (distance) {
    return plan(original, "average_distance", "lookup", {
      subject: term(distance[1], "subject"),
      object: term(distance[2], "object"),
      answerShape: "number",
    });
  }

  const freezes = normalized.match(/^what happens when (.+?) freezes$/);
  if (freezes) {
    return plan(original, "state_transition", "lookup", {
      subject: term(freezes[1], "subject"),
      answerShape: "explanation",
      conditions: ["freezing"],
    });
  }

  if (/^why (?:do|does) (?:human beings|humans|people|we) sleep$/.test(normalized)) {
    return plan(original, "purpose", "lookup", {
      subject: term("human sleep", "subject"),
      answerShape: "explanation",
    });
  }

  const borders = normalized.match(/^what (?:countries|nations) border (.+)$/);
  if (borders) {
    return plan(original, "borders", "list", {
      subject: term(borders[1], "subject"),
      answerShape: "list",
    });
  }

  if (/^when was (?:the )?internet (?:invented|created|developed)$/.test(normalized)) {
    return plan(original, "origin", "lookup", {
      subject: term("Internet", "subject"),
      temporal: "historical development",
      answerShape: "explanation",
    });
  }

  const interesting = normalized.match(/^(?:tell me|give me) (?:something|a fact) interesting about (.+)$/);
  if (interesting) {
    return plan(original, "interesting_fact", "lookup", {
      subject: term(interesting[1], "subject"),
      answerShape: "text",
    });
  }

  if (/^(?:what is|define|explain) (?:a |an |the )?(?:cpu|central processing unit)$/.test(normalized)) {
    return plan(original, "definition", "lookup", {
      subject: term("central processing unit", "subject"),
      answerShape: "text",
    });
  }

  return undefined;
}
