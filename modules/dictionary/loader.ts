import type {
  DictionaryFetcher,
  DictionaryLookupOptions,
  WordsetDictionary,
  WordsetEntry,
} from "./types";

export const WORDSET_ARCHIVE_PATH = "/lexicon/wordset-dictionary.json.gz";

let defaultDictionaryPromise: Promise<WordsetDictionary> | null = null;
const customDictionaryPromises = new WeakMap<
  DictionaryFetcher,
  Map<string, Promise<WordsetDictionary>>
>();
const normalizedKeyIndexes = new WeakMap<WordsetDictionary, Map<string, string>>();

function isWordsetDictionary(value: unknown): value is WordsetDictionary {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function decodeDictionary(response: Response): Promise<WordsetDictionary> {
  if (!response.ok) {
    throw new Error(`Wordset archive request failed with ${response.status}.`);
  }

  const compressed = await response.arrayBuffer();
  const bytes = new Uint8Array(compressed);
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const decoded = isGzip
    ? await new Response(
        new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip")),
      ).json()
    : JSON.parse(new TextDecoder().decode(bytes));

  if (!isWordsetDictionary(decoded)) {
    throw new Error("Wordset archive did not contain a dictionary object.");
  }

  return decoded;
}

async function fetchDictionary(
  fetcher: DictionaryFetcher,
  source: string,
): Promise<WordsetDictionary> {
  return decodeDictionary(await fetcher(source));
}

export function loadWordsetDictionary(
  options: DictionaryLookupOptions = {},
): Promise<WordsetDictionary> {
  const source = options.source ?? WORDSET_ARCHIVE_PATH;
  const fetcher = options.fetcher ?? ((path: string) => fetch(path));

  if (options.fetcher) {
    const sourcePromises = customDictionaryPromises.get(options.fetcher) ?? new Map();
    customDictionaryPromises.set(options.fetcher, sourcePromises);
    const cached = sourcePromises.get(source);
    if (cached) return cached;

    const loading = fetchDictionary(fetcher, source).catch((error) => {
      sourcePromises.delete(source);
      throw error;
    });
    sourcePromises.set(source, loading);
    return loading;
  }

  if (source !== WORDSET_ARCHIVE_PATH) {
    return fetchDictionary(fetcher, source);
  }

  defaultDictionaryPromise ??= fetchDictionary(fetcher, source).catch((error) => {
    defaultDictionaryPromise = null;
    throw error;
  });
  return defaultDictionaryPromise;
}

function normalizedKeyIndex(dictionary: WordsetDictionary): Map<string, string> {
  const cached = normalizedKeyIndexes.get(dictionary);
  if (cached) return cached;

  const index = new Map<string, string>();
  for (const key of Object.keys(dictionary)) {
    const normalized = key.normalize("NFKC").toLocaleLowerCase("en-US");
    if (!index.has(normalized)) index.set(normalized, key);
  }
  normalizedKeyIndexes.set(dictionary, index);
  return index;
}

export async function findWordsetEntry(
  term: string,
  options: DictionaryLookupOptions = {},
): Promise<WordsetEntry | undefined> {
  const dictionary = await loadWordsetDictionary(options);
  const normalized = term.normalize("NFKC").toLocaleLowerCase("en-US");
  const direct = dictionary[normalized] ?? dictionary[term];
  if (direct) return direct;

  const sourceKey = normalizedKeyIndex(dictionary).get(normalized);
  return sourceKey ? dictionary[sourceKey] : undefined;
}
