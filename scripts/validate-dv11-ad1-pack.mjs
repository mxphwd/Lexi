import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { fnv1a } from "./lib/dv11-ad-pack.mjs";

const root = process.cwd();
const publicRoot = resolve(root, "public");
const catalog = JSON.parse(await readFile(resolve(publicRoot, "dv11/service/ad1/catalog.json"), "utf8"));
const sourceManifest = JSON.parse(await readFile(resolve(root, "data/dv11/ad1/source-manifest.json"), "utf8"));
const failures = [];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const at = (path) => resolve(publicRoot, path.replace(/^\//, ""));

async function readChecked(metadata, label, parse = true) {
  try {
    const bytes = await readFile(at(metadata.path));
    if (bytes.length !== metadata.sizeBytes) failures.push(`${label}: size mismatch`);
    if (sha256(bytes) !== metadata.sha256) failures.push(`${label}: SHA-256 mismatch`);
    const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
    if (metadata.decodedSizeBytes !== undefined && decoded.length !== metadata.decodedSizeBytes) failures.push(`${label}: decoded size mismatch`);
    if (metadata.decodedSha256 && sha256(decoded) !== metadata.decodedSha256) failures.push(`${label}: decoded SHA-256 mismatch`);
    return parse ? JSON.parse(decoded.toString("utf8")) : decoded;
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

if (catalog.schemaVersion !== 1 || catalog.runtime !== "DV11" || catalog.extension !== "DV11AD1") failures.push("Catalog schema/runtime/extension mismatch.");
if (catalog.transport.browserRetention !== "matched-records-only" || catalog.transport.serverSideShardLoading !== true) failures.push("AD1 is not Worker-side matched-record retrieval.");
if (catalog.transport.maximumPackagesPerRequest !== 4) failures.push("AD1 request package bound is not the expected four shards.");
if (catalog.exactCounts.queryableWorldPropositions < 600_000 || catalog.exactCounts.queryableWorldPropositions > 800_000) failures.push("Queryable proposition count is outside the 600,000–800,000 target.");
if (catalog.domainPackages.length !== 10 || catalog.domainPackages.some((item) => item.independentlyLoadable !== true)) failures.push("The ten independently loadable AD1 packages are incomplete.");
if (catalog.compiledBehavior.queryExamples < 20_000) failures.push("Compiled query-example coverage is below 20,000.");
if (catalog.compiledBehavior.dialogueScenarios < 4_000) failures.push("Compiled dialogue-scenario coverage is below 4,000.");
if (catalog.source.license !== "CC0-1.0") failures.push("AD1 source license is not declared as CC0-1.0.");
if (sourceManifest.extension !== catalog.extension || sourceManifest.source.id !== catalog.source.id) failures.push("Source manifest identity does not match the generated catalog.");
if (sourceManifest.source.triples.sha256 !== catalog.source.triples.sha256 || sourceManifest.source.aliases.sha256 !== catalog.source.aliases.sha256) failures.push("Pinned source hashes do not match the generated catalog.");

const propositionIds = new Set();
const propositionKeys = new Set();
const packageIds = new Set();
let propositions = 0;
let entitiesAcrossPackages = 0;
let provenanceRows = 0;
let ruleBindings = 0;
for (const [shardKey, metadata] of Object.entries(catalog.sourceShards)) {
  const pack = await readChecked(metadata, `package:${shardKey}`);
  if (!pack) continue;
  const { manifest, ...contents } = pack;
  if (manifest.schemaVersion !== 1 || manifest.minimumRuntime !== "DV11") failures.push(`${shardKey}: incompatible manifest`);
  if (manifest.packageId !== metadata.packageId) failures.push(`${shardKey}: package identity mismatch`);
  if (packageIds.has(manifest.packageId)) failures.push(`${shardKey}: duplicate physical package ID`);
  packageIds.add(manifest.packageId);
  if (manifest.contentHash !== `fnv1a:${fnv1a(JSON.stringify(contents))}`) failures.push(`${shardKey}: content hash mismatch`);
  for (const [field, actual] of [["entities", pack.entities.length], ["propositions", pack.propositions.length], ["schemas", pack.schemas.length], ["senses", pack.senses.length], ["rules", pack.ruleBindings?.length ?? 0], ["relationAliases", pack.relationAliases?.length ?? 0], ["dialogueBehaviors", pack.dialogueBehaviors?.length ?? 0]]) {
    if ((manifest.counts[field] ?? 0) !== actual) failures.push(`${shardKey}: ${field} count mismatch`);
  }
  const localEntities = new Set(pack.entities.map((item) => item.id));
  const localSchemas = new Set(pack.schemas.map((item) => String(item.id)));
  const declaredRelations = new Set([...localSchemas, ...(pack.relationAliases ?? []).map((item) => String(item.relation))]);
  if (localEntities.size !== pack.entities.length) failures.push(`${shardKey}: duplicate entity IDs`);
  if (localSchemas.size !== pack.schemas.length) failures.push(`${shardKey}: duplicate schemas`);
  entitiesAcrossPackages += pack.entities.length;
  ruleBindings += pack.ruleBindings?.length ?? 0;
  for (const proposition of pack.propositions) {
    propositions += 1;
    if (propositionIds.has(proposition.id)) failures.push(`${shardKey}: duplicate global proposition ID ${proposition.id}`);
    propositionIds.add(proposition.id);
    const key = `${proposition.subjectId}\0${proposition.relation}\0${JSON.stringify(proposition.object)}\0${proposition.polarity}`;
    if (propositionKeys.has(key)) failures.push(`${shardKey}: duplicate proposition content ${proposition.id}`);
    propositionKeys.add(key);
    if (!localEntities.has(proposition.subjectId)) failures.push(`${shardKey}: missing subject ${proposition.subjectId}`);
    if (proposition.object.kind !== "entity" || !localEntities.has(proposition.object.entityId)) failures.push(`${shardKey}: invalid or missing object ${proposition.id}`);
    if (!declaredRelations.has(String(proposition.relation))) failures.push(`${shardKey}: undeclared relation ${proposition.relation}`);
    if (!proposition.provenance.length) failures.push(`${shardKey}: missing provenance ${proposition.id}`);
    for (const source of proposition.provenance) {
      provenanceRows += 1;
      if (!source.sourceId || !source.sourceLocation || !source.license || !source.reviewStatus || source.disputeStatus !== "undisputed") failures.push(`${shardKey}: incomplete provenance ${proposition.id}`);
    }
  }
}

for (const family of ["alias", "entity", "subject", "object"]) {
  const index = catalog.indexes[family];
  let entries = 0;
  for (const [bucket, metadata] of Object.entries(index.shards)) {
    const value = await readChecked(metadata, `index:${family}:${bucket}`);
    entries += value ? Object.keys(value).length : 0;
  }
  if (entries !== index.entries) failures.push(`${family}: exact index count mismatch ${entries} != ${index.entries}`);
}
const predicateIndex = await readChecked(catalog.indexes.predicate, "index:predicate");
const domainIndex = await readChecked(catalog.indexes.domain, "index:domain");
if (Object.keys(predicateIndex ?? {}).length !== catalog.exactCounts.indexedWorldPredicates) failures.push("Predicate exact count mismatch.");
if (Object.values(domainIndex ?? {}).reduce((sum, item) => sum + item.propositions, 0) !== propositions) failures.push("Domain proposition total mismatch.");
if (propositions !== catalog.exactCounts.queryableWorldPropositions) failures.push(`Live proposition count mismatch ${propositions} != ${catalog.exactCounts.queryableWorldPropositions}`);
if (propositionIds.size !== propositions || propositionKeys.size !== propositions) failures.push("Proposition uniqueness check failed.");

console.log(JSON.stringify({
  passed: failures.length === 0,
  exactLiveCounts: {
    queryableWorldPropositions: propositions,
    uniqueWorldEntities: catalog.exactCounts.uniqueWorldEntities,
    indexedWorldAliases: catalog.exactCounts.indexedWorldAliases,
    indexedWorldPredicates: catalog.exactCounts.indexedWorldPredicates,
    physicalPackages: packageIds.size,
    entitiesAcrossPhysicalPackages: entitiesAcrossPackages,
    claimProvenanceRows: provenanceRows,
    installedRuleBindingRows: ruleBindings,
  },
  compiledBehavior: catalog.compiledBehavior,
  failures: failures.slice(0, 100),
}, null, 2));
if (failures.length) process.exitCode = 1;
