import type { DictionaryFetcher } from "@/modules/dictionary";
import dv9Manifest from "@/public/dv9/manifest.json";
import { dv9LexicalLookupForms, dv9NormalizeLexical } from "./normalize";
import { isDv9RuntimeEntry } from "./schema";
import type { Dv9LoaderOptions, Dv9RuntimeEntry, Dv9RuntimeShard } from "./types";

export const DV9_LEXICON_BASE_PATH = "/dv9/lexicon";

const defaultPromises = new Map<string, Promise<Dv9RuntimeShard>>();
const customPromises = new WeakMap<DictionaryFetcher, Map<string, Promise<Dv9RuntimeShard>>>();
const maximumCachedShards = 12;
const maximumCachedServiceEntries = 256;
const servicePromises = new Map<string, Promise<Dv9RuntimeEntry | undefined>>();
const shardMetadata = new Map(dv9Manifest.runtimeShards.map((item) => [item.shard, item]));

export class Dv9ShardLoadError extends Error {
  constructor(readonly code: "fetch" | "timeout" | "hash" | "schema" | "decompression" | "canceled", message: string, readonly source: string) {
    super(message);
    this.name = "Dv9ShardLoadError";
  }
}

export function dv9ShardFor(term: string) {
  const first = dv9NormalizeLexical(term)[0]?.toLowerCase();
  return first && /[a-z0-9]/.test(first) ? first : "_";
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function decodeShard(response: Response, shard: string, source: string): Promise<Dv9RuntimeShard> {
  if (!response.ok) throw new Dv9ShardLoadError("fetch", `DV9 lexical shard request failed with ${response.status}.`, source);
  const compressed = await response.arrayBuffer();
  const metadata = shardMetadata.get(shard);
  if (!metadata || dv9Manifest.schemaVersion !== 1 || dv9Manifest.build !== "260802-DV9") throw new Dv9ShardLoadError("schema", "DV9 shard manifest is missing or incompatible.", source);
  if (compressed.byteLength !== metadata.sizeBytes || await sha256(compressed) !== metadata.sha256) throw new Dv9ShardLoadError("hash", `DV9 lexical shard ${shard} failed size or SHA-256 validation.`, source);
  const bytes = new Uint8Array(compressed);
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  let decoded: unknown;
  try {
    if (isGzip && typeof DecompressionStream === "undefined") throw new Dv9ShardLoadError("decompression", "This runtime cannot decompress DV9 lexical shards.", source);
    decoded = isGzip
      ? await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))).json()
      : JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof Dv9ShardLoadError) throw error;
    throw new Dv9ShardLoadError("decompression", error instanceof Error ? error.message : "DV9 shard decompression failed.", source);
  }
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Dv9ShardLoadError("schema", "DV9 lexical shard was not an object.", source);
  for (const entry of Object.values(decoded)) if (!isDv9RuntimeEntry(entry)) throw new Dv9ShardLoadError("schema", "DV9 lexical shard contains an invalid entry.", source);
  return decoded as Dv9RuntimeShard;
}

function cacheSet(cache: Map<string, Promise<Dv9RuntimeShard>>, source: string, pending: Promise<Dv9RuntimeShard>) {
  if (cache.has(source)) cache.delete(source);
  cache.set(source, pending);
  while (cache.size > maximumCachedShards) cache.delete(cache.keys().next().value!);
}

async function fetchWithPolicy(source: string, options: Dv9LoaderOptions) {
  const timeout = Math.max(100, options.timeoutMilliseconds ?? 8_000);
  const attempts = Math.max(1, Math.min(3, (options.maximumRetries ?? 1) + 1));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) throw new Dv9ShardLoadError("canceled", "DV9 shard loading was canceled.", source);
    const controller = new AbortController();
    const abortListener = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abortListener, { once: true });
    const timer = setTimeout(() => controller.abort("timeout"), timeout);
    try {
      const request = options.fetcher ? options.fetcher(source) : fetch(source, { signal: controller.signal });
      return await Promise.race([
        request,
        new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Dv9ShardLoadError(options.signal?.aborted ? "canceled" : "timeout", options.signal?.aborted ? "DV9 shard loading was canceled." : `DV9 shard loading exceeded ${timeout} ms.`, source)), { once: true })),
      ]);
    } catch (error) {
      lastError = error;
      if (error instanceof Dv9ShardLoadError && error.code === "canceled") throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abortListener);
    }
  }
  if (lastError instanceof Dv9ShardLoadError) throw lastError;
  throw new Dv9ShardLoadError("fetch", lastError instanceof Error ? lastError.message : "DV9 shard request failed.", source);
}

export async function loadDv9Shard(shard: string, options: Dv9LoaderOptions = {}) {
  const basePath = options.basePath ?? DV9_LEXICON_BASE_PATH;
  const source = `${basePath}/${shard}.json.gz`;
  if (options.fetcher) {
    const cache = customPromises.get(options.fetcher) ?? new Map<string, Promise<Dv9RuntimeShard>>();
    customPromises.set(options.fetcher, cache);
    const cached = cache.get(source);
    if (cached) return cached;
    const pending = fetchWithPolicy(source, options).then((response) => decodeShard(response, shard, source)).catch((error) => {
      cache.delete(source);
      throw error;
    });
    cacheSet(cache, source, pending);
    return pending;
  }
  const cached = defaultPromises.get(source);
  if (cached) return cached;
  const pending = fetchWithPolicy(source, options).then((response) => decodeShard(response, shard, source)).catch((error) => {
    defaultPromises.delete(source);
    throw error;
  });
  cacheSet(defaultPromises, source, pending);
  return pending;
}

export async function findDv9Entry(term: string, options: Dv9LoaderOptions = {}): Promise<Dv9RuntimeEntry | undefined> {
  const forms = dv9LexicalLookupForms(term);
  if (!forms.length) return undefined;
  if (!options.fetcher && !options.basePath && typeof window !== "undefined") {
    const key = forms.join("|");
    const cached = servicePromises.get(key);
    if (cached) return cached;
    const source = `/api/lexi/lexical?term=${encodeURIComponent(term)}`;
    const pending = fetchWithPolicy(source, options).then(async (response) => {
      if (!response.ok) throw new Dv9ShardLoadError("fetch", `DV11 lexical service request failed with ${response.status}.`, source);
      const value = await response.json() as { schemaVersion?: unknown; entry?: unknown };
      if (value.schemaVersion !== 1 || value.entry !== null && !isDv9RuntimeEntry(value.entry)) throw new Dv9ShardLoadError("schema", "DV11 lexical service returned an invalid entry.", source);
      return value.entry ?? undefined;
    }).catch((error) => {
      servicePromises.delete(key);
      throw error;
    });
    servicePromises.set(key, pending);
    while (servicePromises.size > maximumCachedServiceEntries) servicePromises.delete(servicePromises.keys().next().value!);
    return pending;
  }
  const shard = await loadDv9Shard(dv9ShardFor(forms[0]), options);
  for (const form of forms) if (shard[form]) return shard[form];
  return undefined;
}

export function dv9ShardCacheStats() {
  return { defaultCachedShards: defaultPromises.size, maximumCachedShards, serviceCachedEntries: servicePromises.size, maximumCachedServiceEntries, manifestBuild: dv9Manifest.build, manifestSchemaVersion: dv9Manifest.schemaVersion };
}
