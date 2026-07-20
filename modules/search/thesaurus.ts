import runtimeIndex from "@/data/lexicon/runtime-index.json";

type RuntimeDefinition = {
  word: string;
  meanings: Array<{
    definition: string;
    partOfSpeech?: string;
    example?: string;
    synonyms: string[];
  }>;
};

// The compact browser index is mechanically generated from the complete
// vendored Wordset and Moby sources. Rebuild it with `npm run lexicon:build`.
export const runtimeThesaurus = runtimeIndex.thesaurus as Record<string, string[]>;
export const runtimeDictionary = runtimeIndex.dictionary as Record<string, RuntimeDefinition>;

const reverseThesaurus = Object.entries(runtimeThesaurus).reduce<
  Record<string, string[]>
>((index, [headword, related]) => {
  for (const item of related) {
    index[item] = [...(index[item] ?? []), headword];
  }
  return index;
}, {});

export function expandTerms(terms: string[]): string[] {
  const expanded = new Set(terms);
  for (const term of terms) {
    for (const synonym of runtimeThesaurus[term] ?? []) expanded.add(synonym);
    for (const headword of reverseThesaurus[term] ?? []) expanded.add(headword);
  }
  return [...expanded];
}
