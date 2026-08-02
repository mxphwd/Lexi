import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";

const root = process.cwd();
const manifest = JSON.parse(await readFile(path.join(root, "data/dv9/manifest.json"), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function* rows(file) {
  const input = createReadStream(file).pipe(createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

const artifactEntries = Object.values(manifest.artifacts);
for (const artifact of artifactEntries) {
  const file = path.join(root, artifact.path);
  assert(await sha256(file) === artifact.sha256, `Hash mismatch for ${artifact.path}.`);
}
for (const shard of manifest.runtimeShards) {
  const file = path.join(root, shard.path);
  assert(await sha256(file) === shard.sha256, `Hash mismatch for ${shard.path}.`);
}

const entityIds = new Set();
let entities = 0;
for await (const row of rows(path.join(root, manifest.artifacts.entities.path))) {
  assert(Array.isArray(row) && row.length >= 4, "Invalid entity row.");
  assert(!entityIds.has(row[0]), `Duplicate entity ${row[0]}.`);
  entityIds.add(row[0]);
  entities += 1;
}
assert(entities === manifest.counts.entities, `Entity count mismatch: ${entities}.`);

const factIds = new Set();
const relationPredicates = new Set();
let relationProfiles = 0;
for await (const row of rows(path.join(root, manifest.artifacts.relationProfiles.path))) {
  assert(row && typeof row === "object" && typeof row.predicate === "string", "Invalid relation profile.");
  relationPredicates.add(row.predicate);
  relationProfiles += 1;
}
assert(relationProfiles === manifest.counts.typedRelationProfiles, "Relation-profile count mismatch.");

let facts = 0;
let sourceAttestedFacts = 0;
let mechanicallyDerivedFacts = 0;
const functionalValues = new Map();
const functionalPredicates = new Set(["sense_of", "part_of_speech"]);
for await (const row of rows(path.join(root, manifest.artifacts.atomicFacts.path))) {
  assert(Array.isArray(row) && row.length === 9, "Invalid fact row.");
  const [id, subject, predicate, objectKind, objectValue, source, evidence, confidence, reviewStatus] = row;
  assert(!factIds.has(id), `Duplicate fact ${id}.`);
  assert(entityIds.has(subject), `Missing fact subject ${subject}.`);
  assert(relationPredicates.has(predicate), `Missing relation schema for ${predicate}.`);
  if (objectKind === "entity") assert(entityIds.has(objectValue), `Missing fact object ${objectValue}.`);
  assert(["W", "M", "D"].includes(source), `Unknown source ${source}.`);
  assert(typeof evidence === "string" && evidence.length > 0, `Missing evidence for ${id}.`);
  assert(Number.isFinite(confidence) && confidence >= 0 && confidence <= 1, `Invalid confidence for ${id}.`);
  if (functionalPredicates.has(predicate)) {
    const key = `${subject}\u0000${predicate}`;
    const previous = functionalValues.get(key);
    assert(previous === undefined || previous === objectValue, `Contradictory functional values for ${key}.`);
    functionalValues.set(key, objectValue);
  }
  if (reviewStatus === "mechanically-derived") mechanicallyDerivedFacts += 1;
  else sourceAttestedFacts += 1;
  factIds.add(id);
  facts += 1;
}
assert(facts === manifest.counts.validatedAtomicFacts, `Fact count mismatch: ${facts}.`);
assert(sourceAttestedFacts === manifest.counts.sourceAttestedFacts, "Source-attested fact count mismatch.");
assert(mechanicallyDerivedFacts === manifest.counts.mechanicallyDerivedFacts, "Derived fact count mismatch.");

async function countRows(key) {
  let count = 0;
  for await (const row of rows(path.join(root, manifest.artifacts[key].path))) {
    if (row) count += 1;
  }
  return count;
}

assert(await countRows("inferenceRules") === manifest.counts.inferenceRules, "Inference-rule count mismatch.");
assert(await countRows("dialogueScenarios") === manifest.counts.dialogueScenarios, "Dialogue count mismatch.");

const trainingPrompts = new Set();
let queryPlans = 0;
for await (const row of rows(path.join(root, manifest.artifacts.queryPlanExamples.path))) {
  assert(Array.isArray(row) && typeof row[1] === "string", "Invalid query-plan example.");
  const normalized = row[1].normalize("NFKC").toLowerCase();
  assert(!trainingPrompts.has(normalized), `Duplicate query-plan prompt ${row[0]}.`);
  trainingPrompts.add(normalized);
  queryPlans += 1;
}
assert(queryPlans === manifest.counts.queryPlanExamples, "Query-plan example count mismatch.");

const blindPrompts = new Set();
let blind = 0;
for await (const row of rows(path.join(root, manifest.artifacts.heldOutBlindQuestions.path))) {
  assert(Array.isArray(row) && typeof row[1] === "string", "Invalid blind question.");
  const normalized = row[1].normalize("NFKC").toLowerCase();
  assert(!trainingPrompts.has(normalized), `Blind/training overlap at ${row[0]}.`);
  assert(!blindPrompts.has(normalized), `Duplicate blind question ${row[0]}.`);
  assert(row[3]?.importedByRuntime === false, `Blind case ${row[0]} is not isolated.`);
  blindPrompts.add(normalized);
  blind += 1;
}
assert(blind === manifest.counts.heldOutBlindQuestions, "Blind-question count mismatch.");

assert(manifest.counts.entities >= manifest.targets.entityMinimum, "Entity minimum not reached.");
assert(manifest.counts.entities <= manifest.targets.entityMaximum, "Entity maximum exceeded.");
assert(manifest.counts.explicitLexicalSenses >= manifest.targets.explicitLexicalSensesMinimum, "Sense minimum not reached.");
assert(manifest.counts.explicitLexicalSenses <= manifest.targets.explicitLexicalSensesMaximum, "Sense maximum exceeded.");
assert(manifest.counts.directFinishedConstructions === 0, "DV9 added finished-answer constructions.");

console.log(JSON.stringify({
  valid: true,
  entities,
  facts,
  sourceAttestedFacts,
  mechanicallyDerivedFacts,
  contradictions: 0,
  queryPlans,
  blind,
  runtimeShards: manifest.runtimeShards.length,
}, null, 2));
