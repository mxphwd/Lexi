import type { DictionaryFetcher } from "@/modules/dictionary";
import { isDv9RuntimeEntry } from "./schema";
import type { Dv9LoaderOptions, Dv9RuntimeEntry, Dv9RuntimeShard } from "./types";
import { dv9LexicalLookupForms, dv9NormalizeLexical } from "./normalize";

export const DV9_LEXICON_BASE_PATH = "/dv9/lexicon";

const defaultPromises = new Map<string, Promise<Dv9RuntimeShard>>();
const customPromises = new WeakMap<DictionaryFetcher, Map<string, Promise<Dv9RuntimeShard>>>();

export function dv9ShardFor(term: string) {
  const first = dv9NormalizeLexical(term)[0]?.toLowerCase();
  return first && /[a-z0-9]/.test(first) ? first : "_";
}

async function decodeShard(response: Response): Promise<Dv9RuntimeShard> {
  if (!response.ok) throw new Error(`DV9 lexical shard request failed with ${response.status}.`);
  const compressed = await response.arrayBuffer();
  const bytes = new Uint8Array(compressed);
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const decoded = isGzip
    ? await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))).json()
    : JSON.parse(new TextDecoder().decode(bytes));
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
    throw new Error("DV9 lexical shard was not an object.");
  }
  for (const entry of Object.values(decoded)) {
    if (!isDv9RuntimeEntry(entry)) throw new Error("DV9 lexical shard contains an invalid entry.");
  }
  return decoded as Dv9RuntimeShard;
}

export async function loadDv9Shard(shard: string, options: Dv9LoaderOptions = {}) {
  const basePath = options.basePath ?? DV9_LEXICON_BASE_PATH;
  const source = `${basePath}/${shard}.json.gz`;
  const fetcher = options.fetcher ?? ((path: string) => fetch(path));
  if (options.fetcher) {
    const cache = customPromises.get(options.fetcher) ?? new Map<string, Promise<Dv9RuntimeShard>>();
    customPromises.set(options.fetcher, cache);
    const cached = cache.get(source);
    if (cached) return cached;
    const pending = decodeShard(await fetcher(source)).catch((error) => {
      cache.delete(source);
      throw error;
    });
    cache.set(source, pending);
    return pending;
  }
  const cached = defaultPromises.get(source);
  if (cached) return cached;
  const pending = decodeShard(await fetcher(source)).catch((error) => {
    defaultPromises.delete(source);
    throw error;
  });
  defaultPromises.set(source, pending);
  return pending;
}

export async function findDv9Entry(term: string, options: Dv9LoaderOptions = {}): Promise<Dv9RuntimeEntry | undefined> {
  const forms = dv9LexicalLookupForms(term);
  if (!forms.length) return undefined;
  const shard = await loadDv9Shard(dv9ShardFor(forms[0]), options);
  for (const form of forms) {
    if (shard[form]) return shard[form];
  }
  return undefined;
}
