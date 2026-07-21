import type { LexiReply } from "@/lib/lexi/types";

const openingIntents = new Set(["greeting"]);
const closingIntents = new Set(["farewell"]);
const orderLabels = ["First", "Second", "Third", "Finally"];

function orderedBody(replies: LexiReply[]): string {
  if (replies.length === 0) return "";
  if (replies.length === 1) return replies[0].text;

  return replies
    .map((reply, index) => {
      const label = index === replies.length - 1 && replies.length > 2
        ? "Finally"
        : orderLabels[index];
      return `${label}: ${reply.text}`;
    })
    .join(" ");
}

export function realiseCombinedResponses(
  replies: LexiReply[],
): { text: string; structureId: string } {
  const remaining = [...replies];
  const opening = openingIntents.has(remaining[0]?.trace.interpretedIntent)
    ? remaining.shift()
    : undefined;
  const closing = closingIntents.has(remaining.at(-1)?.trace.interpretedIntent ?? "")
    ? remaining.pop()
    : undefined;
  const body = orderedBody(remaining);
  const parts = [opening?.text, body, closing?.text].filter(Boolean);

  if (opening && closing) {
    return { text: parts.join(" "), structureId: "discourse-conversation-frame" };
  }
  if (opening && remaining.length > 1) {
    return { text: parts.join(" "), structureId: "discourse-opening-multipart" };
  }
  if (opening) {
    return { text: parts.join(" "), structureId: "discourse-opening-answer" };
  }
  if (closing && remaining.length > 1) {
    return { text: parts.join(" "), structureId: "discourse-multipart-closing" };
  }
  if (closing) {
    return { text: parts.join(" "), structureId: "discourse-answer-closing" };
  }

  return { text: body, structureId: "discourse-multipart" };
}
