/** DV13 request scaffolding. Content, negation and qualifiers remain intact. */
export function requestContent(text: string): string {
  let content = text.trim();
  // Only anchored request wrappers are removed; a negative request is not affirmative.
  for (let pass = 0; pass < 3; pass++) {
    const next = content.replace(/^(?:please\s+|(?:could|would|can) you (?:please )?|(?:tell|show|give) me )/i, '').trim();
    if (next === content) break;
    content = next;
  }
  return content;
}

/** These answer nouns are compatible with the declared relation, not arbitrary filler. */
export function compatibleAnswerNoun(noun: string | undefined, relation: string): boolean {
  if (!noun) return true;
  const allowed: Record<string, string[]> = {
    capital: ['city'], country: ['country'], continent: ['continent'],
    inventor: ['person'], creator: ['person'], author: ['person'],
    birthplace: ['place'], headquarters: ['place'], location: ['place'],
  };
  return allowed[relation]?.includes(noun.toLowerCase()) ?? false;
}
