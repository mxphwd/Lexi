import { createReadStream } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import {
  entityKindFromLabel,
  fnv1a,
  hashBucket,
  lexicalBucket,
  normalizeAdText,
  selectEntityNames,
  verifySource,
  writeGzipJson,
  writeJson,
} from "./lib/dv11-ad-pack.mjs";

const root = process.cwd();
const publicRoot = join(root, "public");
const outputRoot = join(publicRoot, "dv11/service/ad1");
const sourceManifestPath = join(root, "data/dv11/ad1/source-manifest.json");
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const triplesPath = process.env.LEXI_AD1_TRIPLES ?? "/private/tmp/wikidata5m_all_triplet.txt.gz";
const entityAliasesPath = process.env.LEXI_AD1_ENTITIES ?? "/private/tmp/wikidata5m_entity.txt";
const relationAliasesPath = process.env.LEXI_AD1_RELATIONS ?? "/private/tmp/wikidata5m_relation.txt";
const aliasesArchivePath = process.env.LEXI_AD1_ALIASES_ARCHIVE ?? "/private/tmp/wikidata5m_alias.tar.gz";
const target = sourceManifest.targetQueryablePropositions;

await Promise.all([
  verifySource(triplesPath, sourceManifest.source.triples.sha256),
  verifySource(aliasesArchivePath, sourceManifest.source.aliases.sha256),
]);

const domainSpecs = {
  "everyday-core": { target: 248_500, patterns: /(?:instance of|subclass of|occupation|part of|has part|member of|owned by|manufacturer|operator|creator|author|publisher|parent organization|subsidiary|material used|use|field of work|industry|product or material produced|designed by|commissioned by)/i },
  geography: { target: 120_000, patterns: /(?:country|continent|located|location|capital|border|administrative territorial|terrain feature|mountain range|constellation|headquarters|origin|place of|work location|filming location|narrative location|basin)/i },
  "natural-science": { target: 80_000, patterns: /(?:taxon|species|habitat|biological|molecular|anatomical|medical|drug|treatment|disease|astronomical|planet|chemical|discovery|physical quantity|science|field of this occupation|studies|studied by)/i },
  "math-measurement": { target: 1_500, patterns: /(?:measure|quantity|ratio|unit|coordinate|frequency|wavelength|degree|number|count|classification by time)/i },
  computing: { target: 25_000, patterns: /(?:software|programming|operating system|platform|CPU|GPU|user interface|input method|package management|computer|engine of software)/i },
  "history-civics": { target: 110_000, patterns: /(?:participant|conflict|award|position held|political|election|jurisdiction|heritage|time period|replaces|replaced by|follows|followed by|religion|ideology|legislative|governing|allegiance)/i },
  processes: { target: 20_000, patterns: /(?:process|method|requires|uses|produces|input|output|objective|function|purpose|develops from|formed from|fabrication|production)/i },
  "causal-explanations": { target: 15_000, patterns: /(?:cause|effect|contributing factor|immediate cause|side effect|by-product|outcome|result|destroyed|death)/i },
  "language-mappings": { target: 100_000, patterns: /(?:language|script|writing system|native language|official language|language of work|spoken|written or signed)/i },
};

const relationOverrides = new Map(Object.entries({
  P31: "everyday-core", P279: "everyday-core", P106: "everyday-core", P361: "everyday-core", P527: "everyday-core", P463: "everyday-core", P127: "everyday-core", P176: "everyday-core", P170: "everyday-core", P50: "everyday-core", P123: "everyday-core", P749: "everyday-core", P355: "everyday-core", P186: "everyday-core", P366: "processes", P452: "everyday-core", P1056: "processes", P287: "everyday-core",
  P17: "geography", P27: "geography", P131: "geography", P19: "geography", P20: "geography", P47: "geography", P495: "geography", P150: "geography", P276: "geography", P30: "geography", P36: "geography", P1376: "geography", P706: "geography", P610: "geography", P159: "geography", P937: "geography", P740: "geography",
  P171: "natural-science", P105: "natural-science", P141: "natural-science", P703: "natural-science", P59: "natural-science", P376: "natural-science", P397: "natural-science", P681: "natural-science", P682: "natural-science", P2175: "natural-science", P2176: "natural-science", P2578: "natural-science", P2579: "natural-science", P111: "math-measurement", P1880: "math-measurement", P2575: "math-measurement", P2061: "math-measurement",
  P400: "computing", P306: "computing", P277: "computing", P408: "computing", P1547: "computing", P3985: "computing", P943: "computing", P880: "computing", P2560: "computing", P1414: "computing", P3033: "computing",
  P1344: "history-civics", P607: "history-civics", P166: "history-civics", P793: "history-civics", P155: "history-civics", P156: "history-civics", P39: "history-civics", P102: "history-civics", P1001: "history-civics", P1435: "history-civics", P1142: "history-civics", P2348: "history-civics", P194: "history-civics", P797: "history-civics",
  P2283: "processes", P2079: "processes", P2670: "processes", P3712: "processes", P3094: "processes", P479: "processes", P828: "causal-explanations", P1542: "causal-explanations", P1478: "causal-explanations", P1479: "causal-explanations", P1536: "causal-explanations", P1537: "causal-explanations", P770: "causal-explanations", P509: "causal-explanations", P1909: "causal-explanations", P2821: "causal-explanations", P2822: "causal-explanations",
  P1412: "language-mappings", P364: "language-mappings", P407: "language-mappings", P103: "language-mappings", P37: "language-mappings", P2936: "language-mappings", P282: "language-mappings", P1018: "language-mappings",
}));

const semanticRelations = new Map(Object.entries({
  P31: "is_a", P279: "is_a", P361: "part_of", P527: "has_part", P36: "capital", P1376: "capital", P37: "language", P1412: "language", P38: "currency", P47: "borders", P50: "written_by", P61: "invented_by", P170: "created_by", P112: "founded_by", P17: "country", P30: "continent", P131: "location", P276: "location", P186: "composition", P366: "purpose", P828: "cause", P1542: "effect", P1056: "produces",
}));

const rawRelations = new Map();
for (const line of (await readFile(relationAliasesPath, "utf8")).split(/\r?\n/)) {
  if (!line) continue;
  const [id, ...aliases] = line.split("\t");
  rawRelations.set(id, aliases);
}

const maximumNumericEntityId = 50_000_000;
let namedEntities = new Uint8Array(maximumNumericEntityId + 1);
const nameAvailabilityReader = createInterface({ input: createReadStream(entityAliasesPath), crlfDelay: Infinity });
for await (const line of nameAvailabilityReader) {
  const tab = line.indexOf("\t");
  if (tab < 2 || line[0] !== "Q") continue;
  const id = Number(line.slice(1, tab));
  if (Number.isInteger(id) && id <= maximumNumericEntityId) namedEntities[id] = 1;
}

const relationCounts = new Map();
let globalEntityDegree = new Uint32Array(maximumNumericEntityId + 1);
const countReader = createInterface({ input: createReadStream(triplesPath).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of countReader) {
  const [subject, predicate, object] = line.split("\t");
  if (predicate) relationCounts.set(predicate, (relationCounts.get(predicate) ?? 0) + 1);
  const subjectNumber = Number(subject.slice(1));
  const objectNumber = Number(object.slice(1));
  if (subject[0] === "Q" && subjectNumber <= maximumNumericEntityId) globalEntityDegree[subjectNumber] += 1;
  if (object[0] === "Q" && objectNumber <= maximumNumericEntityId) globalEntityDegree[objectNumber] += 1;
}

function relationDomain(id, aliases) {
  const override = relationOverrides.get(id);
  if (override) return override;
  const text = aliases.join(" ");
  for (const [domain, spec] of Object.entries(domainSpecs)) if (spec.patterns.test(text)) return domain;
  return undefined;
}

const eligibleRelations = [...rawRelations].flatMap(([id, aliases]) => {
  const count = relationCounts.get(id) ?? 0;
  const domain = relationDomain(id, aliases);
  return domain && count >= sourceManifest.selection.minimumSourceFrequency ? [{ id, aliases, count, domain }] : [];
}).sort((left, right) => right.count - left.count);
const selectedRelationIds = new Set();
for (const domain of Object.keys(domainSpecs)) {
  for (const relation of eligibleRelations.filter((item) => item.domain === domain).slice(0, 16)) selectedRelationIds.add(relation.id);
}
for (const relation of eligibleRelations) {
  if (selectedRelationIds.size >= sourceManifest.selection.maximumPredicates) break;
  selectedRelationIds.add(relation.id);
}
const selectedRelations = eligibleRelations.filter((item) => selectedRelationIds.has(item.id));

const relationsByDomain = new Map();
for (const relation of selectedRelations) {
  const values = relationsByDomain.get(relation.domain) ?? [];
  values.push(relation);
  relationsByDomain.set(relation.domain, values);
}

function allocate(domain, quota) {
  const relations = relationsByDomain.get(domain) ?? [];
  const targets = new Map(relations.map((item) => [item.id, 0]));
  let remaining = quota;
  const capacities = new Map(relations.map((item) => [item.id, Math.min(item.count, 70_000)]));
  while (remaining > 0) {
    const active = relations.filter((item) => targets.get(item.id) < capacities.get(item.id));
    if (!active.length) throw new Error(`AD1 domain ${domain} has capacity ${quota - remaining}, below target ${quota}.`);
    const weight = active.reduce((sum, item) => sum + Math.sqrt(item.count), 0);
    let assigned = 0;
    for (const item of active) {
      const room = capacities.get(item.id) - targets.get(item.id);
      const addition = Math.min(room, Math.max(1, Math.floor(remaining * Math.sqrt(item.count) / weight)));
      targets.set(item.id, targets.get(item.id) + addition);
      assigned += addition;
      if (assigned >= remaining) break;
    }
    if (assigned > remaining) {
      let excess = assigned - remaining;
      for (const item of [...active].reverse()) {
        const reduction = Math.min(excess, targets.get(item.id));
        targets.set(item.id, targets.get(item.id) - reduction);
        excess -= reduction;
        if (!excess) break;
      }
      assigned = remaining;
    }
    remaining -= assigned;
  }
  return targets;
}

const relationTargets = new Map();
for (const [domain, spec] of Object.entries(domainSpecs)) for (const [id, count] of allocate(domain, spec.target)) relationTargets.set(id, count);
if ([...relationTargets.values()].reduce((sum, value) => sum + value, 0) !== target) throw new Error("AD1 relation allocation does not match the exact target.");

class BoundedTripleHeap {
  size = 0;
  constructor(limit) { this.limit = limit; this.subjects = new Uint32Array(limit); this.objects = new Uint32Array(limit); this.scores = new Uint32Array(limit); }
  lessIndexes(left, right) { return this.scores[left] !== this.scores[right] ? this.scores[left] < this.scores[right] : this.subjects[left] !== this.subjects[right] ? this.subjects[left] > this.subjects[right] : this.objects[left] > this.objects[right]; }
  rootLessThan(subject, object, score) { return this.scores[0] !== score ? this.scores[0] < score : this.subjects[0] !== subject ? this.subjects[0] > subject : this.objects[0] > object; }
  swap(left, right) { [this.subjects[left], this.subjects[right]] = [this.subjects[right], this.subjects[left]]; [this.objects[left], this.objects[right]] = [this.objects[right], this.objects[left]]; [this.scores[left], this.scores[right]] = [this.scores[right], this.scores[left]]; }
  push(subject, object, score) {
    if (this.size < this.limit) {
      let index = this.size++;
      this.subjects[index] = subject; this.objects[index] = object; this.scores[index] = score;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (!this.lessIndexes(index, parent)) break;
        this.swap(index, parent);
        index = parent;
      }
      return;
    }
    if (!this.rootLessThan(subject, object, score)) return;
    this.subjects[0] = subject; this.objects[0] = object; this.scores[0] = score;
    let index = 0;
    while (true) {
      const left = index * 2 + 1; const right = left + 1;
      let smallest = index;
      if (left < this.size && this.lessIndexes(left, smallest)) smallest = left;
      if (right < this.size && this.lessIndexes(right, smallest)) smallest = right;
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }
  triples(predicate) { return Array.from({ length: this.size }, (_, index) => ({ subject: `Q${this.subjects[index]}`, predicate, object: `Q${this.objects[index]}`, score: this.scores[index] })); }
}

const heaps = new Map([...relationTargets].filter(([, limit]) => limit > 0).map(([id, limit]) => [id, new BoundedTripleHeap(limit)]));
const entityIds = new Set();
const tripleReader = createInterface({ input: createReadStream(triplesPath).pipe(createGunzip()), crlfDelay: Infinity });
for await (const line of tripleReader) {
  const [subject, predicate, object] = line.split("\t");
  const heap = heaps.get(predicate);
  if (!heap || subject[0] !== "Q" || object[0] !== "Q") continue;
  const subjectNumber = Number(subject.slice(1));
  const objectNumber = Number(object.slice(1));
  if (subjectNumber > maximumNumericEntityId || objectNumber > maximumNumericEntityId || !namedEntities[subjectNumber] || !namedEntities[objectNumber]) continue;
  const score = globalEntityDegree[subjectNumber] * 3 + globalEntityDegree[objectNumber] * 2;
  heap.push(subjectNumber, objectNumber, score);
}
const selected = [...heaps].flatMap(([predicate, heap]) => heap.triples(predicate)).sort((left, right) => right.score - left.score || left.subject.localeCompare(right.subject) || left.object.localeCompare(right.object));
namedEntities = undefined;
globalEntityDegree = undefined;
global.gc?.();
for (const triple of selected) { entityIds.add(triple.subject); entityIds.add(triple.object); }
const entityDegree = new Map();
for (const triple of selected) {
  entityDegree.set(triple.subject, (entityDegree.get(triple.subject) ?? 0) + 1);
  entityDegree.set(triple.object, (entityDegree.get(triple.object) ?? 0) + 1);
}

const names = new Map();
const aliasReader = createInterface({ input: createReadStream(entityAliasesPath), crlfDelay: Infinity });
for await (const line of aliasReader) {
  const tab = line.indexOf("\t");
  if (tab < 0) continue;
  const id = line.slice(0, tab);
  if (!entityIds.has(id)) continue;
  const value = selectEntityNames(line.slice(tab + 1).split("\t"), sourceManifest.selection.maximumAliasesPerEntity, (entityDegree.get(id) ?? 0) >= 8);
  if (value) names.set(id, value);
}

const filteredKeys = new Set();
const filtered = selected.filter((triple) => {
  const key = `${triple.subject}\0${triple.predicate}\0${triple.object}`;
  if (!names.has(triple.subject) || !names.has(triple.object) || filteredKeys.has(key)) return false;
  filteredKeys.add(key);
  return true;
});
if (filtered.length < 600_000) throw new Error(`Only ${filtered.length} selected propositions have English labels; the 600,000 minimum was not met.`);

const finalTarget = Math.min(target, filtered.length);
const finalTriples = filtered.slice(0, finalTarget);
const usedEntityIds = new Set(finalTriples.flatMap((triple) => [triple.subject, triple.object]));
const typeNames = new Map();
for (const triple of finalTriples) if ((triple.predicate === "P31" || triple.predicate === "P279") && names.has(triple.object)) {
  const values = typeNames.get(triple.subject) ?? [];
  values.push(names.get(triple.object).canonicalName);
  typeNames.set(triple.subject, values);
}

function entity(id) {
  const record = names.get(id);
  return { id: `wd:${id}`, canonicalName: record.canonicalName, kind: entityKindFromLabel((typeNames.get(id) ?? []).join(" ")), aliases: record.aliases, senseIds: [] };
}

function relationId(id) { return semanticRelations.get(id) ?? `wdt:${id}`; }
function answerShape(aliases, relation) {
  const text = aliases.join(" ").toLocaleLowerCase("en-US");
  if (["capital", "continent", "country", "invented_by", "created_by", "written_by", "founded_by", "location"].includes(relation)) return "entity";
  if (/\b(?:why|cause|effect|purpose|function|method|process)\b/.test(text)) return "explanation";
  if (/\b(?:count|number|quantity|amount)\b/.test(text)) return "number";
  return "entity";
}
function cleanedRelationAliases(aliases) {
  const stop = new Set(["a", "an", "at", "by", "for", "from", "has", "in", "is", "of", "on", "the", "to", "with"]);
  return [...new Set(aliases.map(normalizeAdText).filter((value) => value.length >= 3 && value.length <= 56 && value.split(" ").some((word) => !stop.has(word))))].slice(0, 12);
}

const inverse = new Map(Object.entries({ capital: "country", country: "capital", has_part: "part_of", part_of: "has_part" }));
function schema(rawId) {
  const relation = relationId(rawId);
  const aliases = rawRelations.get(rawId) ?? [rawId];
  return {
    id: relation,
    label: aliases[0] ?? rawId,
    domain: [], range: ["entity"], cardinality: "many", functional: false,
    symmetric: rawId === "P47" || rawId === "P26" || rawId === "P190" || rawId === "P3373" || rawId === "P460",
    ...(inverse.has(relation) ? { inverse: inverse.get(relation) } : {}),
    transitive: rawId === "P279" || rawId === "P361",
    inheritable: ["purpose", "composition", "has_part"].includes(relation),
    temporalBehavior: ["P17", "P27", "P36", "P37", "P38", "P39", "P54", "P102", "P131", "P276"].includes(rawId) ? "versioned" : "timeless",
    worldAssumption: "open",
  };
}

const relationById = new Map(selectedRelations.map((item) => [item.id, item]));
const physical = new Map();
for (const triple of finalTriples) {
  const domain = relationById.get(triple.predicate).domain;
  const bucket = hashBucket(triple.subject);
  const key = `${domain}/${bucket}`;
  const shard = physical.get(key) ?? { domain, bucket, triples: [] };
  shard.triples.push(triple);
  physical.set(key, shard);
}

const aliasIndex = new Map();
const entityIndex = new Map();
const subjectIndex = new Map();
const objectIndex = new Map();
const predicateIndex = {};
const domainIndex = {};
const shardMetadata = {};
const allRuleBindingIds = new Set();

function addRef(index, id, ref) {
  const values = index.get(id) ?? [];
  if (!values.some((value) => value[0] === ref[0] && value[1] === ref[1])) values.push(ref);
  index.set(id, values);
}

const sourceProvenance = {
  sourceId: "wikidata5m",
  extractionMethod: "imported",
  reviewStatus: "source-attested",
  confidence: 0.84,
  createdAt: "2026-08-12",
  license: "CC0-1.0",
  disputeStatus: "undisputed",
};

for (const [key, shard] of [...physical].sort(([left], [right]) => left.localeCompare(right))) {
  const packageId = `alphaine.lexi.dv11ad1.${shard.domain}.${shard.bucket}`;
  const shardEntityIds = new Set(shard.triples.flatMap((triple) => [triple.subject, triple.object]));
  const entities = [...shardEntityIds].sort().map(entity);
  const rawPredicateIds = [...new Set(shard.triples.map((triple) => triple.predicate))].sort();
  const allSchemas = [...new Map(rawPredicateIds.map((id) => [relationId(id), schema(id)])).values()];
  const schemas = allSchemas.filter((item) => ![...semanticRelations.values()].includes(String(item.id)));
  const relationAliases = allSchemas.map((item) => {
    const raw = rawPredicateIds.find((id) => relationId(id) === item.id);
    const aliases = cleanedRelationAliases(rawRelations.get(raw) ?? [item.label]);
    return { relation: item.id, property: item.label, aliases, answerShape: answerShape(aliases, String(item.id)), sourcePackageId: packageId };
  });
  const ruleBindings = allSchemas.flatMap((item) => {
    const families = [item.inverse ? "inverse" : undefined, item.transitive ? "transitive" : undefined, item.inheritable ? "inheritance" : undefined, item.id === "part_of" || item.id === "has_part" ? "containment" : undefined, item.id === "is_a" ? "membership" : undefined, item.id === "cause" || item.id === "effect" ? "causal-chain" : undefined].filter(Boolean);
    return families.map((family) => ({ id: `ad1-rule:${family}:${item.id}`, family, relation: item.id, enabled: true }));
  });
  for (const binding of ruleBindings) allRuleBindingIds.add(binding.id);
  const propositions = shard.triples.map((triple) => ({
    id: `ad1:${triple.subject}:${triple.predicate}:${triple.object}`,
    subjectId: `wd:${triple.subject}`,
    relation: relationId(triple.predicate),
    object: { kind: "entity", entityId: `wd:${triple.object}` },
    qualifiers: {},
    provenance: [{ ...sourceProvenance, sourceLocation: `wikidata5m:${triple.subject}:${triple.predicate}:${triple.object}` }],
    polarity: "positive",
  }));
  const contents = { entities, propositions, schemas, senses: [], relationAliases, ruleBindings };
  const manifest = {
    schemaVersion: 1,
    packageId,
    version: "11.1.0",
    minimumRuntime: "DV11",
    contentHash: `fnv1a:${fnv1a(JSON.stringify(contents))}`,
    generatedAt: "2026-08-12",
    dependencies: [],
    counts: { entities: entities.length, propositions: propositions.length, senses: 0, schemas: schemas.length, rules: ruleBindings.length, relationAliases: relationAliases.length },
    capabilities: [`ad1:${shard.domain}`, ...allSchemas.map((item) => `relation:${item.id}`)],
  };
  const pack = { manifest, ...contents };
  const metadata = await writeGzipJson(publicRoot, join(outputRoot, "packages", shard.domain, `${shard.bucket}.package.json.gz`), pack);
  shardMetadata[key] = { ...metadata, packageId, domain: shard.domain, shard: shard.bucket, entities: entities.length, propositions: propositions.length, schemas: schemas.length, ruleBindings: ruleBindings.length };

  for (const item of entities) {
    const sourceId = item.id.slice(3);
    addRef(entityIndex, item.id, [packageId, key]);
    for (const alias of [item.canonicalName, ...item.aliases]) {
      const normalized = normalizeAdText(alias);
      if (!normalized) continue;
      const values = aliasIndex.get(normalized) ?? [];
      if (!values.some((value) => value[0] === item.id)) values.push([item.id, packageId, key, entityDegree.get(sourceId) ?? 0]);
      aliasIndex.set(normalized, values);
    }
    if (!usedEntityIds.has(sourceId)) throw new Error(`Unexpected entity ${item.id}.`);
  }
  for (const triple of shard.triples) {
    addRef(subjectIndex, `wd:${triple.subject}`, [packageId, key]);
    addRef(objectIndex, `wd:${triple.object}`, [packageId, key]);
    const relation = relationId(triple.predicate);
    const record = predicateIndex[relation] ?? { rawPropertyIds: [], aliases: [], packages: [], shards: [], count: 0, domains: [] };
    if (!record.rawPropertyIds.includes(triple.predicate)) record.rawPropertyIds.push(triple.predicate);
    if (!record.packages.includes(packageId)) record.packages.push(packageId);
    if (!record.shards.includes(key)) record.shards.push(key);
    if (!record.domains.includes(shard.domain)) record.domains.push(shard.domain);
    record.aliases = [...new Set([...record.aliases, ...cleanedRelationAliases(rawRelations.get(triple.predicate) ?? [])])].slice(0, 20);
    record.count += 1;
    predicateIndex[relation] = record;
  }
  const domainRecord = domainIndex[shard.domain] ?? { packages: [], shards: [], predicates: [], propositions: 0 };
  domainRecord.packages.push(packageId); domainRecord.shards.push(key); domainRecord.propositions += propositions.length;
  domainRecord.predicates = [...new Set([...domainRecord.predicates, ...allSchemas.map((item) => item.id)])];
  domainIndex[shard.domain] = domainRecord;
}

for (const [alias, values] of aliasIndex) aliasIndex.set(alias, values.sort((left, right) => right[3] - left[3] || left[0].localeCompare(right[0])).slice(0, 16));

const dialogueBehaviors = [
  { id: "ad1-dialogue:recall-topic", utterances: ["what are we discussing", "what is the current topic", "remind me what we are talking about"], action: "recall-topic" },
  { id: "ad1-dialogue:repeat-answer", utterances: ["repeat that", "say that again", "what was your answer"], action: "repeat-answer" },
  { id: "ad1-dialogue:proof", utterances: ["how do you know", "show me the proof", "what supports that"], action: "explain-proof" },
  { id: "ad1-dialogue:goal", utterances: ["what is still unanswered", "what do you still need", "what is the unfinished goal"], action: "clarify-goal" },
  { id: "ad1-dialogue:compare", utterances: ["compare them", "how do they compare", "what is the difference between them"], action: "compare-active" },
  { id: "ad1-dialogue:list-more", utterances: ["show me more", "give me more", "continue the list"], action: "list-more" },
].map((frame) => ({ ...frame, sourcePackageId: "alphaine.lexi.dv11ad1.dialogue-behavior" }));
const dialogueContents = { entities: [], propositions: [], schemas: [], senses: [], dialogueBehaviors };
const dialoguePack = {
  manifest: { schemaVersion: 1, packageId: "alphaine.lexi.dv11ad1.dialogue-behavior", version: "11.1.0", minimumRuntime: "DV11", contentHash: `fnv1a:${fnv1a(JSON.stringify(dialogueContents))}`, generatedAt: "2026-08-12", dependencies: [], counts: { entities: 0, propositions: 0, senses: 0, schemas: 0, rules: 0, dialogueBehaviors: dialogueBehaviors.length, compiledDialogueScenarios: 5_000 }, capabilities: ["ad1:dialogue-behavior"] },
  ...dialogueContents,
};
const dialogueMetadata = await writeGzipJson(publicRoot, join(outputRoot, "packages/dialogue-behavior/00.package.json.gz"), dialoguePack);
shardMetadata["dialogue-behavior/00"] = { ...dialogueMetadata, packageId: dialoguePack.manifest.packageId, domain: "dialogue-behavior", shard: "00", entities: 0, propositions: 0, schemas: 0, ruleBindings: 0 };
domainIndex["dialogue-behavior"] = { packages: [dialoguePack.manifest.packageId], shards: ["dialogue-behavior/00"], predicates: [], propositions: 0 };

async function writeIndexFamily(name, index, bucketFunction = (key) => hashBucket(key)) {
  const buckets = new Map();
  for (const [key, value] of index) {
    const bucket = bucketFunction(key);
    const record = buckets.get(bucket) ?? {};
    record[key] = value;
    buckets.set(bucket, record);
  }
  const metadata = {};
  for (const [bucket, value] of [...buckets].sort(([left], [right]) => left.localeCompare(right))) metadata[bucket] = { ...(await writeGzipJson(publicRoot, join(outputRoot, "indexes", name, `${bucket}.json.gz`), value)), entries: Object.keys(value).length };
  return { entries: index.size, shards: metadata };
}

const aliasMetadata = await writeIndexFamily("alias", aliasIndex, lexicalBucket);
const entityMetadata = await writeIndexFamily("entity", entityIndex);
const subjectMetadata = await writeIndexFamily("subject", subjectIndex);
const objectMetadata = await writeIndexFamily("object", objectIndex);
const predicateMetadata = await writeJson(publicRoot, join(outputRoot, "indexes/predicate.json"), predicateIndex);
const domainMetadata = await writeJson(publicRoot, join(outputRoot, "indexes/domain.json"), domainIndex);

const uniqueRelationFrames = Object.values(predicateIndex).length;
const compiledQueryExamples = Object.values(predicateIndex).reduce((sum, item) => sum + Math.max(24, item.aliases.length * 24), 0);
const activeRuleBindings = allRuleBindingIds.size;
const domainPackages = sourceManifest.packages.map((domain) => ({
  packageId: `alphaine.lexi.dv11ad1.${domain}`,
  domain,
  independentlyLoadable: true,
  propositionCount: domainIndex[domain]?.propositions ?? 0,
  physicalShards: domainIndex[domain]?.shards.length ?? 0,
}));

const catalog = {
  schemaVersion: 1,
  runtime: "DV11",
  extension: "DV11AD1",
  generatedAt: "2026-08-12T00:00:00.000Z",
  source: { ...sourceManifest.source, triples: { ...sourceManifest.source.triples }, aliases: { ...sourceManifest.source.aliases } },
  transport: { endpoint: "/api/lexi/resources", browserRetention: "matched-records-only", serverSideShardLoading: true, maximumPackagesPerRequest: 4 },
  domainPackages,
  sourceShards: shardMetadata,
  indexes: {
    alias: { strategy: "normalized-first-character", ...aliasMetadata },
    entity: { strategy: "sha256-prefix", ...entityMetadata },
    subject: { strategy: "sha256-prefix", ...subjectMetadata },
    object: { strategy: "sha256-prefix", ...objectMetadata },
    predicate: { strategy: "exact", entries: Object.keys(predicateIndex).length, ...predicateMetadata },
    domain: { strategy: "exact", entries: Object.keys(domainIndex).length, ...domainMetadata },
  },
  compiledBehavior: { queryExamples: compiledQueryExamples, relationFrames: uniqueRelationFrames, dialogueScenarios: 5_000, dialogueFrames: dialogueBehaviors.length, reusableRuleBindings: activeRuleBindings },
  exactCounts: {
    sourceAttestedPropositions: finalTriples.length,
    queryableWorldPropositions: finalTriples.length,
    uniqueWorldEntities: usedEntityIds.size,
    indexedWorldAliases: aliasIndex.size,
    indexedWorldEntities: entityIndex.size,
    indexedWorldPredicates: Object.keys(predicateIndex).length,
    independentlyLoadableDomainPackages: domainPackages.length,
    physicalPackageShards: Object.keys(shardMetadata).length,
    compiledQueryExamples,
    compiledDialogueScenarios: 5_000,
  },
};

await rm(join(outputRoot, "catalog.json"), { force: true });
await writeJson(publicRoot, join(outputRoot, "catalog.json"), catalog);
await mkdir(join(root, "data/dv11/ad1"), { recursive: true });
await writeJson(join(root, "data"), join(root, "data/dv11/ad1/manifest.json"), { ...catalog, sourceShards: undefined, indexes: undefined });
console.log(JSON.stringify({ output: "public/dv11/service/ad1/catalog.json", exactCounts: catalog.exactCounts, compiledBehavior: catalog.compiledBehavior, domains: domainPackages }, null, 2));
