import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { validateDataPack } from '../modules/dv15/validator.ts';

const root = process.cwd();
const write = process.argv.includes('--write');
const option = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const sourceRoot = path.resolve(root, option('--input') ?? 'data/dv15/inbox');
const outputRoot = path.resolve(root, option('--output') ?? 'data/dv15/compact');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value);
const files = fs.readdirSync(sourceRoot, { recursive: true })
  .filter((entry) => String(entry).endsWith('.json') && path.basename(String(entry)) !== 'schema.json')
  .map((entry) => path.join(sourceRoot, String(entry))).sort();

function compact(pack) {
  const factRelations = new Set(pack.facts.map((fact) => fact.relation));
  const factEntities = new Set(pack.facts.flatMap((fact) => [fact.subject, fact.object.kind === 'entity' ? fact.object.id : '']));
  const relations = pack.relations.filter((relation) => factRelations.has(relation.id));
  const entities = pack.entities.filter((entity) => factEntities.has(entity.id));
  const facts = pack.facts.map((fact) => {
    const sources = fact.sources && (fact.sources.length !== 1 || json(fact.sources[0]) !== json(fact.source)) ? fact.sources : undefined;
    const { sources: _unused, ...withoutSources } = fact;
    return sources ? { ...withoutSources, sources } : withoutSources;
  });
  return {
    manifest: { ...pack.manifest, propositionCount: facts.length, entityCount: entities.length, relationCount: relations.length },
    relations,
    entities,
    facts,
  };
}

const report = { schema: 'lexi.dv15.compact.v1', generatedAt: new Date().toISOString(), source: path.relative(root, sourceRoot), output: path.relative(root, outputRoot), write, files: files.length, sourceBytes: 0, compactBytes: 0, gzipBytes: 0, prunedEntities: 0, prunedRelations: 0, omittedDuplicateSourceArrays: 0, failures: [] };
if (write && fs.existsSync(outputRoot)) throw new Error('DV15_COMPACT_OUTPUT_EXISTS: move or remove data/dv15/compact before rebuilding');
if (write) fs.mkdirSync(outputRoot, { recursive: true });
for (let index = 0; index < files.length; index += 1) {
  const file = files[index];
  try {
    const bytes = fs.readFileSync(file);
    const pack = validateDataPack(JSON.parse(bytes));
    const next = compact(pack);
    validateDataPack(next);
    const encoded = Buffer.from(json(next));
    const compressed = zlib.gzipSync(encoded, { level: 9 });
    report.sourceBytes += bytes.length;
    report.compactBytes += encoded.length;
    report.gzipBytes += compressed.length;
    report.prunedEntities += pack.entities.length - next.entities.length;
    report.prunedRelations += pack.relations.length - next.relations.length;
    report.omittedDuplicateSourceArrays += pack.facts.filter((fact) => fact.sources?.length === 1 && json(fact.sources[0]) === json(fact.source)).length;
    if (write) {
      const relative = path.relative(sourceRoot, file).replace(/\.json$/, '.pack.json.gz');
      const destination = path.join(outputRoot, 'packs', relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, compressed);
    }
  } catch (error) {
    report.failures.push({ file: path.relative(root, file), error: error instanceof Error ? error.message : String(error) });
  }
  if ((index + 1) % 250 === 0) process.stderr.write(`DV15 compacted ${index + 1}/${files.length}\n`);
}
report.sourceSha256 = hash(JSON.stringify({ files, sourceBytes: report.sourceBytes }));
report.compressionRatio = report.sourceBytes ? Number((report.gzipBytes / report.sourceBytes).toFixed(4)) : 0;
if (write) fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;
