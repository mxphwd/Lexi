export type WordsetMeaning = {
  id: string;
  def: string;
  speech_part?: string;
  example?: string;
  synonyms?: string[];
};

export type WordsetEntry = {
  word: string;
  wordset_id: string;
  meanings: WordsetMeaning[];
};

export type WordsetDictionary = Record<string, WordsetEntry>;

export type DictionaryFetcher = (source: string) => Promise<Response>;

export type DictionaryLookupOptions = {
  fetcher?: DictionaryFetcher;
  source?: string;
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
};
