import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const directory = path.join(process.cwd(), "data", "example-contexts");
const files = (await readdir(directory)).filter((file) => /^\d{2,}-.+\.json$/.test(file)).sort();
const ids = new Set();
const normalizedInputs = new Map();
const errors = [];
const pageSummaries = [];
let entries = 0;
const modes = new Set(["declarative", "interrogative", "imperative", "exclamative"]);
const tones = new Set(["neutral", "warm", "precise", "cautious"]);
const slugPattern = /^[a-z0-9-]+$/;

for (const file of files) {
  const page = JSON.parse(await readFile(path.join(directory, file), "utf8"));
  if (page.schemaVersion !== 1) errors.push(`${file}: schemaVersion must be 1`);
  if (page.page?.id !== file.slice(0, -5)) errors.push(`${file}: page.id must match the filename`);
  if (!slugPattern.test(page.page?.id ?? "")) errors.push(`${file}: page.id must be a lowercase slug`);
  for (const key of ["title", "description"]) {
    if (typeof page.page?.[key] !== "string" || !page.page[key].trim()) {
      errors.push(`${file}: page.${key} must be a non-empty string`);
    }
  }
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
    if (!slugPattern.test(entry.intent ?? "")) errors.push(`${file}/${entry.id}: intent must be a lowercase slug`);
    if (!modes.has(entry.mode)) errors.push(`${file}/${entry.id}: unsupported sentence mode ${entry.mode}`);
    if (!Array.isArray(entry.keywords)) {
      errors.push(`${file}/${entry.id}: keywords must be an array`);
    } else if (entry.keywords.some((keyword) => typeof keyword !== "string" || !/^[a-z0-9-]+$/.test(keyword))) {
      errors.push(`${file}/${entry.id}: keywords must be normalized lowercase terms without punctuation`);
    }
    if (!entry.context?.domain || !entry.context?.purpose || !entry.context?.tone) {
      errors.push(`${file}/${entry.id}: context requires domain, purpose, and tone`);
    }
    if (!tones.has(entry.context?.tone)) errors.push(`${file}/${entry.id}: unsupported context tone ${entry.context?.tone}`);
    if (entry.slots && (typeof entry.slots !== "object" || Array.isArray(entry.slots) || Object.values(entry.slots).some((value) => typeof value !== "string"))) {
      errors.push(`${file}/${entry.id}: slots must contain only string values`);
    }

    const normalizedInput = typeof entry.input === "string"
      ? entry.input.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
      : "";
    const previous = normalizedInputs.get(normalizedInput);
    if (normalizedInput && previous) {
      errors.push(`${file}/${entry.id}: duplicate normalized input also used by ${previous}`);
    } else if (normalizedInput) {
      normalizedInputs.set(normalizedInput, `${file}/${entry.id}`);
    }
  }

  pageSummaries.push({
    id: page.page.id,
    file,
    title: page.page.title,
    description: page.page.description,
    examples: page.entries.length,
    intents: [...new Set(page.entries.map((entry) => entry.intent))].sort(),
  });
}

try {
  const inventory = JSON.parse(await readFile(path.join(directory, "context-inventory.json"), "utf8"));
  if (inventory.schemaVersion !== 1) errors.push("context-inventory.json: schemaVersion must be 1");
  if (inventory.totalPages !== files.length) errors.push("context-inventory.json: totalPages is stale");
  if (inventory.totalExamples !== entries) errors.push("context-inventory.json: totalExamples is stale");
  if (inventory.totalPairedSentences !== entries * 2) errors.push("context-inventory.json: totalPairedSentences is stale");
  if (JSON.stringify(inventory.pages) !== JSON.stringify(pageSummaries)) {
    errors.push("context-inventory.json: page ledger is stale; run npm run corpus:inventory");
  }
} catch {
  errors.push("context-inventory.json: missing or invalid; run npm run corpus:inventory");
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${files.length} context pages and ${entries} examples (${entries * 2} paired sentences).`);
}
