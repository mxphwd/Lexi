import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createDv11KnowledgeStore, validateDv11Package } from "../modules/dv11/store.ts";

const directory = resolve("data/dv11/packages");
const files = (await readdir(directory)).filter((name) => name.endsWith(".package.json")).sort();
const results = [];
for (const file of files) {
  const pack = JSON.parse(await readFile(resolve(directory, file), "utf8"));
  const errors = validateDv11Package(pack);
  if (!errors.length) {
    const store = createDv11KnowledgeStore();
    try { store.addPackage(pack); errors.push(...store.validateIntegrity()); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
  }
  results.push({ file, packageId: pack.manifest?.packageId, valid: errors.length === 0, errors });
}
console.log(JSON.stringify({ packages: results.length, passed: results.every((item) => item.valid), results }, null, 2));
if (results.some((item) => !item.valid)) process.exitCode = 1;
