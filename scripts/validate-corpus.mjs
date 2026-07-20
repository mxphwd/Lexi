import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const directory = path.join(process.cwd(), "data", "example-contexts");
const files = (await readdir(directory)).filter((file) => /^\d{2}-.+\.json$/.test(file)).sort();
const ids = new Set();
const errors = [];
let entries = 0;

for (const file of files) {
  const page = JSON.parse(await readFile(path.join(directory, file), "utf8"));
  if (page.schemaVersion !== 1) errors.push(`${file}: schemaVersion must be 1`);
  if (page.page?.language !== "en") errors.push(`${file}: page language must be en`);
  if (!Array.isArray(page.entries) || page.entries.length < 1) {
    errors.push(`${file}: entries must be a non-empty array`);
    continue;
  }

  for (const entry of page.entries) {
    entries += 1;
    if (ids.has(entry.id)) errors.push(`${file}: duplicate entry id ${entry.id}`);
    ids.add(entry.id);
    for (const key of ["id", "intent", "input", "response", "mode"]) {
      if (typeof entry[key] !== "string" || !entry[key].trim()) {
        errors.push(`${file}/${entry.id ?? "unknown"}: missing ${key}`);
      }
    }
    if (!Array.isArray(entry.keywords)) errors.push(`${file}/${entry.id}: keywords must be an array`);
    if (!entry.context?.domain || !entry.context?.purpose || !entry.context?.tone) {
      errors.push(`${file}/${entry.id}: context requires domain, purpose, and tone`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} context pages and ${entries} examples (${entries * 2} paired sentences).`);
}
