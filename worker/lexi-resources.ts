import { dv11LexicalPackageFromEntry } from "../modules/dv11/lexical-package";
import type { Dv11ResourceRequest, Dv11ResourceResponse } from "../modules/dv11/types";
import { dv9LexicalLookupForms, dv9NormalizeLexical } from "../modules/dv9/normalize";
import { isDv9RuntimeEntry } from "../modules/dv9/schema";
import type { Dv9RuntimeShard } from "../modules/dv9/types";

export interface LexiAssetFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

type AssetMetadata = { path: string; sha256: string; sizeBytes: number; decodedSha256?: string; decodedSizeBytes?: number; entries: number };
type AliasRecord = readonly [lexemeId: string, senseIds: string[], packageId: string, sourceShard: string];
type EntityRecord = readonly [label: string, kind: string, sources: string[], sourceShard: string | null, packageId: string];
type SenseRecord = readonly [lexemeId: string, sourceShard: string, partOfSpeech: string, packageId: string];
type ServiceCatalog = {
  schemaVersion: 1;
  runtime: "DV11";
  packages: Array<{ sourceShards: Array<AssetMetadata & { shard: string }> }>;
  indexes: {
    alias: { entries: number; shards: Record<string, AssetMetadata> };
    entity: { entries: number; shards: Record<string, AssetMetadata> };
    predicate: { entries: number; path: string };
    domain: { entries: number; path: string };
    senseToShard: { entries: number; shards: Record<string, AssetMetadata> };
  };
  exactSourceCounts: Dv11ResourceResponse["service"];
};

const jsonCache = new Map<string, unknown>();
const maximumCachedIndexes = 12;

function normalizeAssetPath(path: string) {
  const withoutPublic = path.replace(/^public\//, "");
  return withoutPublic.startsWith("/") ? withoutPublic : `/${withoutPublic}`;
}

function cacheJson(path: string, value: unknown) {
  if (jsonCache.has(path)) jsonCache.delete(path);
  jsonCache.set(path, value);
  while (jsonCache.size > maximumCachedIndexes) jsonCache.delete(jsonCache.keys().next().value!);
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function hashBucket(value: string) {
  return (await sha256(new TextEncoder().encode(value).buffer as ArrayBuffer)).slice(0, 2);
}

async function assetResponse(assets: LexiAssetFetcher, path: string, requestUrl: string) {
  const response = await assets.fetch(new Request(new URL(normalizeAssetPath(path), requestUrl)));
  if (!response.ok) throw new Error(`LEXI_RESOURCE_ASSET_${response.status}:${path}`);
  return response;
}

async function loadJson<T>(assets: LexiAssetFetcher, path: string, requestUrl: string, metadata?: AssetMetadata): Promise<T> {
  const normalizedPath = normalizeAssetPath(path);
  const cached = jsonCache.get(normalizedPath);
  if (cached !== undefined) return cached as T;
  const response = await assetResponse(assets, normalizedPath, requestUrl);
  const compressed = await response.arrayBuffer();
  const bytes = new Uint8Array(compressed);
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (metadata) {
    const digest = await sha256(compressed);
    const compressedMatch = compressed.byteLength === metadata.sizeBytes && digest === metadata.sha256;
    const decodedMatch = !gzip && metadata.decodedSizeBytes !== undefined && metadata.decodedSha256 !== undefined
      && compressed.byteLength === metadata.decodedSizeBytes && digest === metadata.decodedSha256;
    if (!compressedMatch && !decodedMatch) throw new Error(`LEXI_RESOURCE_HASH_MISMATCH:${normalizedPath}`);
  }
  const parsed = gzip
    ? await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))).json()
    : JSON.parse(new TextDecoder().decode(bytes));
  cacheJson(normalizedPath, parsed);
  return parsed as T;
}

async function catalog(assets: LexiAssetFetcher, requestUrl: string) {
  const value = await loadJson<ServiceCatalog>(assets, "/dv11/service/catalog.json", requestUrl);
  if (value.schemaVersion !== 1 || value.runtime !== "DV11") throw new Error("LEXI_RESOURCE_CATALOG_INCOMPATIBLE");
  return value;
}

async function findEntry(term: string, assets: LexiAssetFetcher, requestUrl: string, serviceCatalog: ServiceCatalog) {
  const forms = dv9LexicalLookupForms(term);
  for (const form of forms) {
    const bucket = /^[a-z0-9]/.test(form[0] ?? "") ? form[0] : "_";
    const indexMetadata = serviceCatalog.indexes.alias.shards[bucket];
    if (!indexMetadata) continue;
    const aliases = await loadJson<Record<string, AliasRecord>>(assets, indexMetadata.path, requestUrl, indexMetadata);
    const alias = aliases[form];
    if (!alias) continue;
    const sourceMetadata = serviceCatalog.packages[0]?.sourceShards.find((item) => item.shard === alias[3]);
    if (!sourceMetadata) throw new Error(`LEXI_RESOURCE_SOURCE_SHARD_MISSING:${alias[3]}`);
    const shard = await loadJson<Dv9RuntimeShard>(assets, sourceMetadata.path, requestUrl, sourceMetadata);
    const entry = shard[form] ?? Object.values(shard).find((candidate) => candidate.e === alias[0]);
    if (entry && isDv9RuntimeEntry(entry)) return { form, alias, entry };
  }
  return undefined;
}

function checkedStringArray(value: unknown, maximum: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 256)))].slice(0, maximum);
}

function validRequest(value: unknown): Dv11ResourceRequest {
  if (!value || typeof value !== "object" || (value as { schemaVersion?: unknown }).schemaVersion !== 1) throw new Error("LEXI_RESOURCE_REQUEST_INVALID");
  const input = value as Partial<Dv11ResourceRequest>;
  return {
    schemaVersion: 1,
    normalized: typeof input.normalized === "string" ? input.normalized.slice(0, 12_000) : "",
    aliases: checkedStringArray(input.aliases, 32),
    entityIds: checkedStringArray(input.entityIds, 32),
    senseIds: checkedStringArray(input.senseIds, 32),
    predicates: checkedStringArray(input.predicates, 32),
    domains: checkedStringArray(input.domains, 16),
    loadedPackageIds: checkedStringArray(input.loadedPackageIds, 128),
  };
}

async function matchedIndexKeys(input: Dv11ResourceRequest, assets: LexiAssetFetcher, requestUrl: string, serviceCatalog: ServiceCatalog) {
  const entityIds: string[] = [];
  for (const id of input.entityIds) {
    const metadata = serviceCatalog.indexes.entity.shards[await hashBucket(id)];
    if (!metadata) continue;
    const index = await loadJson<Record<string, EntityRecord>>(assets, metadata.path, requestUrl, metadata);
    if (index[id]) entityIds.push(id);
  }
  const senseIds: string[] = [];
  for (const id of input.senseIds) {
    const metadata = serviceCatalog.indexes.senseToShard.shards[await hashBucket(id)];
    if (!metadata) continue;
    const index = await loadJson<Record<string, SenseRecord>>(assets, metadata.path, requestUrl, metadata);
    if (index[id]) senseIds.push(id);
  }
  const predicates = await loadJson<Record<string, unknown>>(assets, serviceCatalog.indexes.predicate.path, requestUrl);
  const domains = await loadJson<Record<string, unknown>>(assets, serviceCatalog.indexes.domain.path, requestUrl);
  return {
    entityIds,
    senseIds,
    predicates: input.predicates.filter((id) => predicates[id] !== undefined),
    domains: input.domains.filter((id) => domains[dv9NormalizeLexical(id)] !== undefined || domains[id] !== undefined),
  };
}

export async function handleLexiResources(request: Request, assets: LexiAssetFetcher): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/lexi/resources" && url.pathname !== "/api/lexi/lexical") return undefined;
  try {
    const serviceCatalog = await catalog(assets, request.url);
    if (url.pathname === "/api/lexi/lexical") {
      if (request.method !== "GET") return Response.json({ error: "Method not allowed." }, { status: 405 });
      const term = url.searchParams.get("term")?.slice(0, 256) ?? "";
      const found = term ? await findEntry(term, assets, request.url, serviceCatalog) : undefined;
      return Response.json({ schemaVersion: 1, entry: found?.entry ?? null, service: serviceCatalog.exactSourceCounts }, { headers: { "cache-control": "private, max-age=300" } });
    }
    if (request.method === "GET") return Response.json({ schemaVersion: 1, service: serviceCatalog.exactSourceCounts, transport: "matched-records-only" });
    if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
    const input = validRequest(await request.json());
    const packages = [];
    const aliases: string[] = [];
    const packageIds = new Set(input.loadedPackageIds);
    for (const alias of input.aliases) {
      const found = await findEntry(alias, assets, request.url, serviceCatalog);
      if (!found) continue;
      aliases.push(found.form);
      const pack = dv11LexicalPackageFromEntry(found.entry);
      if (!packageIds.has(pack.manifest.packageId)) {
        packages.push(pack);
        packageIds.add(pack.manifest.packageId);
      }
    }
    const matched = await matchedIndexKeys(input, assets, request.url, serviceCatalog);
    const response: Dv11ResourceResponse = {
      schemaVersion: 1,
      packages,
      matched: { aliases: [...new Set(aliases)], ...matched },
      service: serviceCatalog.exactSourceCounts,
    };
    return Response.json(response, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "LEXI_RESOURCE_ERROR" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export function lexiResourceCacheStats() {
  return { parsedAssets: jsonCache.size, maximumParsedAssets: maximumCachedIndexes };
}
