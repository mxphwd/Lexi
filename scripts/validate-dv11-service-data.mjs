import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const root = process.cwd();
const catalog = JSON.parse(await readFile(resolve(root, "public/dv11/service/catalog.json"), "utf8"));
const failures = [];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const filePath = (path) => resolve(root, path.replace(/^\//, "public/").replace(/^public\/public\//, "public/"));

async function check(metadata, label) {
  try {
    const bytes = await readFile(filePath(metadata.path));
    if (bytes.length !== metadata.sizeBytes) failures.push(`${label}: size ${bytes.length} != ${metadata.sizeBytes}`);
    if (sha256(bytes) !== metadata.sha256) failures.push(`${label}: SHA-256 mismatch`);
    if (metadata.decodedSizeBytes !== undefined || metadata.decodedSha256 !== undefined) {
      const decoded = gunzipSync(bytes);
      if (decoded.length !== metadata.decodedSizeBytes) failures.push(`${label}: decoded size ${decoded.length} != ${metadata.decodedSizeBytes}`);
      if (sha256(decoded) !== metadata.decodedSha256) failures.push(`${label}: decoded SHA-256 mismatch`);
    }
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (catalog.schemaVersion !== 1 || catalog.runtime !== "DV11") failures.push("Catalog schema/runtime is incompatible.");
for (const pack of catalog.packages) for (const shard of pack.sourceShards) await check(shard, `source:${shard.shard}`);
for (const family of ["alias", "entity", "senseToShard"]) {
  const index = catalog.indexes[family];
  const entries = Object.values(index.shards).reduce((sum, item) => sum + item.entries, 0);
  if (entries !== index.entries) failures.push(`${family}: shard entries ${entries} != ${index.entries}`);
  for (const [shard, metadata] of Object.entries(index.shards)) await check(metadata, `${family}:${shard}`);
}
await check(catalog.indexes.predicate, "predicate");
await check(catalog.indexes.domain, "domain");
await check(catalog.compiledLanguage, "compiled-language");

const counts = catalog.exactSourceCounts;
if (counts.indexedAliases !== catalog.indexes.alias.entries) failures.push("Alias count does not match exact source counts.");
if (counts.indexedEntities !== catalog.indexes.entity.entries) failures.push("Entity count does not match exact source counts.");
if (counts.indexedSenses !== catalog.indexes.senseToShard.entries) failures.push("Sense count does not match exact source counts.");
if (counts.indexedPredicates !== catalog.indexes.predicate.entries) failures.push("Predicate count does not match exact source counts.");
if (counts.indexedDomains !== catalog.indexes.domain.entries) failures.push("Domain count does not match exact source counts.");
if (catalog.transport.browserRetention !== "matched-records-only" || catalog.transport.rawPacksImportedByClient !== false) failures.push("Browser retention policy is not matched-records-only.");

console.log(JSON.stringify({
  passed: failures.length === 0,
  filesChecked: catalog.packages.reduce((sum, pack) => sum + pack.sourceShards.length, 0)
    + Object.values(catalog.indexes.alias.shards).length
    + Object.values(catalog.indexes.entity.shards).length
    + Object.values(catalog.indexes.senseToShard.shards).length + 3,
  exactSourceCounts: counts,
  compiledLanguage: {
    queryFrames: catalog.compiledLanguage.queryFrames,
    dialogueFrames: catalog.compiledLanguage.dialogueFrames,
    transitions: catalog.compiledLanguage.transitions,
  },
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
