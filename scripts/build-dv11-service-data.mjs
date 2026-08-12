import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

const root = process.cwd();
const dv9Root = join(root, "data/dv9");
const dv9Packs = join(dv9Root, "packs");
const outputRoot = join(root, "public/dv11/service");
const indexRoot = join(outputRoot, "indexes");
const compiledSourcePath = join(root, "data/dv11/compiled-language.json");
const packageId = "alphaine.lexi.dv9.lexical";

const normalize = (value) => String(value ?? "")
  .normalize("NFKC")
  .toLocaleLowerCase("en-US")
  .replace(/\s+/g, " ")
  .trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hashBucket = (value) => sha256(value).slice(0, 2);
const lexicalBucket = (value) => /^[a-z0-9]/.test(normalize(value)[0] ?? "") ? normalize(value)[0] : "_";

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  await writeFile(path, bytes);
  return { path: relative(root, path), sha256: sha256(bytes), sizeBytes: bytes.length };
}

async function writeGzipJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const decoded = Buffer.from(JSON.stringify(value));
  const bytes = gzipSync(decoded, { level: 9 });
  await writeFile(path, bytes);
  return {
    path: `/${relative(join(root, "public"), path)}`,
    sha256: sha256(bytes),
    sizeBytes: bytes.length,
    decodedSha256: sha256(decoded),
    decodedSizeBytes: decoded.length,
  };
}

function jsonl(path) {
  return gunzipSync(path).toString("utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function replaceTerm(prompt, term) {
  const lowerPrompt = prompt.toLocaleLowerCase("en-US");
  const lowerTerm = term.toLocaleLowerCase("en-US");
  let index = lowerPrompt.lastIndexOf(lowerTerm);
  if (index < 0) return undefined;
  return {
    prefix: normalize(prompt.slice(0, index)),
    suffix: normalize(prompt.slice(index + term.length)).replace(/^[?!.]+|[?!.]+$/g, ""),
  };
}

await rm(outputRoot, { recursive: true, force: true });

const dv9Manifest = JSON.parse(await readFile(join(dv9Root, "manifest.json"), "utf8"));
const aliasBuckets = new Map();
const senseBuckets = new Map();
const senseToLexeme = new Map();
let aliasCount = 0;
let senseCount = 0;

for (const metadata of dv9Manifest.runtimeShards) {
  const compressed = await readFile(join(root, metadata.path));
  const entries = JSON.parse(gunzipSync(compressed).toString("utf8"));
  const aliases = {};
  for (const [alias, entry] of Object.entries(entries)) {
    aliases[alias] = [entry.e, entry.m.map((meaning) => meaning[0]), packageId, metadata.shard];
    aliasCount += 1;
    for (const meaning of entry.m) {
      const [senseId, partOfSpeech] = meaning;
      const bucket = hashBucket(senseId);
      const senses = senseBuckets.get(bucket) ?? {};
      senses[senseId] = [entry.e, metadata.shard, partOfSpeech, packageId];
      senseBuckets.set(bucket, senses);
      senseToLexeme.set(senseId, entry.e);
      senseCount += 1;
    }
  }
  aliasBuckets.set(metadata.shard, aliases);
}

const entityBuckets = new Map();
for (const row of jsonl(await readFile(join(dv9Packs, "entities.jsonl.gz")))) {
  const [id, label, kind, sources] = row;
  const bucket = hashBucket(id);
  const entities = entityBuckets.get(bucket) ?? {};
  entities[id] = [label, kind, sources, kind === "sense" ? senseBuckets.get(bucket)?.[id]?.[1] ?? null : lexicalBucket(label), packageId];
  entityBuckets.set(bucket, entities);
}

const predicateIndex = {};
for (const shard of dv9Manifest.artifacts.atomicFacts.shards) {
  for (const row of jsonl(await readFile(join(root, shard.path)))) {
    const predicate = row[2];
    const current = predicateIndex[predicate] ?? { packages: [packageId], shards: [], count: 0 };
    if (!current.shards.includes(basename(shard.path))) current.shards.push(basename(shard.path));
    current.count += 1;
    predicateIndex[predicate] = current;
  }
}

const domainIndex = {};
for (const row of jsonl(await readFile(join(dv9Packs, "relation-profiles.jsonl.gz")))) {
  const key = row.domain;
  const current = domainIndex[key] ?? { packages: [packageId], predicates: [], profiles: 0 };
  if (!current.predicates.includes(row.predicate)) current.predicates.push(row.predicate);
  current.profiles += 1;
  domainIndex[key] = current;
}
for (const value of Object.values(domainIndex)) value.predicates.sort();

const compiledQueryFrames = new Map();
for (const row of jsonl(await readFile(join(dv9Packs, "query-plan-examples.jsonl.gz")))) {
  const [, prompt, plan] = row;
  const key = `${plan.frame}:${plan.operation}`;
  const current = compiledQueryFrames.get(key) ?? { id: plan.frame, operation: plan.operation, prefix: undefined, suffix: undefined, samples: 0 };
  current.samples += 1;
  if (current.prefix === undefined && String(plan.term).length >= 4) {
    const parts = replaceTerm(prompt, String(plan.term));
    if (parts) Object.assign(current, parts);
  }
  compiledQueryFrames.set(key, current);
}

const compiledDialogueFrames = new Map();
for (const row of jsonl(await readFile(join(dv9Packs, "dialogue-scenarios.jsonl.gz")))) {
  const [, scenario] = row;
  const current = compiledDialogueFrames.get(scenario.frame) ?? { id: scenario.frame, samples: 0, states: scenario.state, transitions: [] };
  current.samples += 1;
  for (let index = 0; index < scenario.turns.length - 1; index += 1) {
    const [role, utterance] = scenario.turns[index];
    const [nextRole, action] = scenario.turns[index + 1];
    if (role !== "user" || nextRole !== "lexi" || index === 0) continue;
    const normalized = normalize(utterance).replace(/[?!.]+$/g, "");
    if (!current.transitions.some((item) => item.utterance === normalized && item.action === action)) current.transitions.push({ utterance: normalized, action });
  }
  compiledDialogueFrames.set(scenario.frame, current);
}

const queryFrames = [...compiledQueryFrames.values()].filter((frame) => frame.prefix !== undefined).sort((left, right) => left.id.localeCompare(right.id));
const dialogueFrames = [...compiledDialogueFrames.values()].sort((left, right) => left.id.localeCompare(right.id));
const compiledLanguage = {
  schemaVersion: 1,
  sourceBuild: dv9Manifest.build,
  sourceExamples: dv9Manifest.counts.queryPlanExamples,
  sourceDialogueScenarios: dv9Manifest.counts.dialogueScenarios,
  queryFrames,
  dialogueFrames,
  compiledQueryFrameCount: queryFrames.length,
  compiledDialogueFrameCount: dialogueFrames.length,
  compiledTransitionCount: dialogueFrames.reduce((sum, frame) => sum + frame.transitions.length, 0),
};
await writeJson(compiledSourcePath, compiledLanguage);

const aliasShards = {};
for (const [bucket, index] of aliasBuckets) aliasShards[bucket] = { ...(await writeGzipJson(join(indexRoot, "alias", `${bucket}.json.gz`), index)), entries: Object.keys(index).length };
const entityShards = {};
for (const [bucket, index] of entityBuckets) entityShards[bucket] = { ...(await writeGzipJson(join(indexRoot, "entity", `${bucket}.json.gz`), index)), entries: Object.keys(index).length };
const senseShards = {};
for (const [bucket, index] of senseBuckets) senseShards[bucket] = { ...(await writeGzipJson(join(indexRoot, "sense", `${bucket}.json.gz`), index)), entries: Object.keys(index).length };
const predicateMetadata = await writeJson(join(indexRoot, "predicate.json"), predicateIndex);
const domainMetadata = await writeJson(join(indexRoot, "domain.json"), domainIndex);
const compiledMetadata = await writeJson(join(outputRoot, "compiled-language.json"), compiledLanguage);

const catalog = {
  schemaVersion: 1,
  runtime: "DV11",
  sourceBuild: dv9Manifest.build,
  generatedAt: new Date(0).toISOString(),
  transport: { endpoint: "/api/lexi/resources", browserRetention: "matched-records-only", rawPacksImportedByClient: false },
  packages: [{
    packageId,
    kind: "lexical",
    version: "9.0.0-service",
    routes: ["lexical"],
    sourceShards: await Promise.all(dv9Manifest.runtimeShards.map(async (shard) => {
      const compressed = await readFile(join(root, shard.path));
      const decoded = gunzipSync(compressed);
      return {
        shard: shard.shard,
        path: `/${relative(join(root, "public"), join(root, shard.path))}`,
        sha256: shard.sha256,
        sizeBytes: shard.sizeBytes,
        decodedSha256: sha256(decoded),
        decodedSizeBytes: decoded.length,
        entries: shard.entries,
      };
    })),
  }],
  indexes: {
    alias: { strategy: "normalized-first-character", entries: aliasCount, shards: aliasShards },
    entity: { strategy: "sha256-prefix", entries: dv9Manifest.counts.entities, shards: entityShards },
    predicate: { strategy: "exact", entries: Object.keys(predicateIndex).length, ...predicateMetadata },
    domain: { strategy: "exact", entries: Object.keys(domainIndex).length, ...domainMetadata },
    senseToShard: { strategy: "sha256-prefix", entries: senseCount, shards: senseShards },
  },
  compiledLanguage: { ...compiledMetadata, queryFrames: queryFrames.length, dialogueFrames: dialogueFrames.length, transitions: compiledLanguage.compiledTransitionCount },
  exactSourceCounts: {
    indexedAliases: aliasCount,
    indexedEntities: dv9Manifest.counts.entities,
    indexedSenses: senseCount,
    indexedPredicates: Object.keys(predicateIndex).length,
    indexedDomains: Object.keys(domainIndex).length,
    serverQueryableLexicalFacts: Object.values(predicateIndex).reduce((sum, item) => sum + item.count, 0),
  },
};

await writeJson(join(outputRoot, "catalog.json"), catalog);
console.log(JSON.stringify({ catalog: relative(root, join(outputRoot, "catalog.json")), ...catalog.exactSourceCounts, compiledLanguage: catalog.compiledLanguage }, null, 2));
