import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const directory = path.join(process.cwd(), "data", "example-contexts");
const target = path.join(directory, "context-inventory.json");
const files = (await readdir(directory)).filter((file) => /^\d{2,}-.+\.json$/.test(file)).sort();
const pages = [];

for (const file of files) {
  const page = JSON.parse(await readFile(path.join(directory, file), "utf8"));
  pages.push({
    id: page.page.id,
    file,
    title: page.page.title,
    description: page.page.description,
    examples: page.entries.length,
    intents: [...new Set(page.entries.map((entry) => entry.intent))].sort(),
  });
}

const inventory = {
  schemaVersion: 1,
  totalPages: pages.length,
  totalExamples: pages.reduce((sum, page) => sum + page.examples, 0),
  totalPairedSentences: pages.reduce((sum, page) => sum + page.examples * 2, 0),
  pages,
};

await writeFile(target, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
console.log(`Indexed ${inventory.totalPages} pages and ${inventory.totalExamples} examples in context-inventory.json.`);
