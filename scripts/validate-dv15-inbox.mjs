import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateDataPack } from '../modules/dv15/validator.ts';

const root = process.cwd();
const inbox = path.resolve(process.argv[2] ?? 'data/dv15/inbox');
const reportPath = path.join(root, 'artifacts/dv15-inbox-validation.json');
const files = fs.existsSync(inbox) ? fs.readdirSync(inbox, { recursive: true }).filter((name) => String(name).endsWith('.json') && path.basename(String(name)) !== 'schema.json').map((name) => path.join(inbox, String(name))).sort() : [];
const packs = [];
const seen = new Map();
const errors = [];
for (const file of files) {
  try {
    const bytes = fs.readFileSync(file);
    const pack = validateDataPack(JSON.parse(bytes));
    for (const id of [...pack.relations.map((x) => `relation:${x.id}`), ...pack.entities.map((x) => `entity:${x.id}`), ...pack.facts.map((x) => `fact:${x.id}`)]) {
      const previous = seen.get(id);
      if (previous) throw new Error(`DV15_INBOX_DUPLICATE_ID:${id}:${previous}`);
      seen.set(id, file);
    }
    packs.push({ file: path.relative(root, file), id: pack.manifest.id, tier: pack.manifest.tier, category: pack.manifest.category, propositions: pack.facts.length, entities: pack.entities.length, relations: pack.relations.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  } catch (error) {
    errors.push({ file: path.relative(root, file), error: error instanceof Error ? error.message : String(error) });
  }
}
const report = { schema: 'lexi.dv15.inbox.v1', generatedAt: new Date().toISOString(), inbox: path.relative(root, inbox), files: packs, errors, totals: { files: packs.length, propositions: packs.reduce((n, x) => n + x.propositions, 0), entities: packs.reduce((n, x) => n + x.entities, 0), relations: packs.reduce((n, x) => n + x.relations, 0) }, passed: errors.length === 0 };
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
