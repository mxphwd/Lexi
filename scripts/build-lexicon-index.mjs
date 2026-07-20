import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const root = process.cwd();
const wordsetPath = path.join(root, "data/lexicon/vendor/wordset/allwords_wordset.json.gz");
const mobyPath = path.join(root, "data/lexicon/vendor/moby/words.txt");
const outputPath = path.join(root, "data/lexicon/runtime-index.json");

const selectedTerms = [
  "ai", "answer", "artificial intelligence", "build", "capability", "clause",
  "combine", "connect", "context", "create", "define", "deterministic",
  "dictionary", "different", "example", "generate", "grammar", "greeting",
  "hello", "help", "interpret", "language", "lexicon", "meaning", "mechanical",
  "model", "module", "predict", "reply", "response", "rule", "search",
  "sentence", "similar", "structure", "synonym", "thesaurus", "understand", "word",
];

const normalize = (value) => value.trim().toLocaleLowerCase("en-US");
const selected = new Set(selectedTerms.map(normalize));
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const [wordsetArchive, mobyBuffer] = await Promise.all([
  readFile(wordsetPath),
  readFile(mobyPath),
]);

const wordset = JSON.parse(gunzipSync(wordsetArchive).toString("utf8"));
const dictionary = {};
for (const term of selected) {
  const entry = wordset[term] ?? wordset[term[0]?.toUpperCase() + term.slice(1)];
  if (!entry) continue;
  dictionary[term] = {
    word: entry.word,
    meanings: (entry.meanings ?? []).slice(0, 3).map((meaning) => ({
      definition: meaning.def,
      partOfSpeech: meaning.speech_part,
      example: meaning.example,
      synonyms: (meaning.synonyms ?? []).slice(0, 8),
    })),
  };
}

const relations = Object.fromEntries([...selected].map((term) => [term, new Set()]));
for (const line of mobyBuffer.toString("utf8").split(/\r?\n/)) {
  if (!line) continue;
  const terms = line.split(",").map(normalize).filter(Boolean);
  const selectedOnLine = terms.filter((term) => selected.has(term));
  for (const headword of selectedOnLine) {
    const bucket = relations[headword];
    for (const relation of terms) {
      if (relation !== headword && bucket.size < 48) bucket.add(relation);
    }
  }
}

for (const [term, entry] of Object.entries(dictionary)) {
  const bucket = relations[term] ?? new Set();
  for (const meaning of entry.meanings) {
    for (const synonym of meaning.synonyms) {
      if (bucket.size < 48) bucket.add(normalize(synonym));
    }
  }
  relations[term] = bucket;
}

const payload = {
  schemaVersion: 1,
  generatedFrom: {
    wordset: {
      repository: "https://github.com/wordset/wordset-dictionary",
      sha256: sha256(wordsetArchive),
      license: "CC BY-SA 4.0",
    },
    moby: {
      repository: "https://github.com/words/moby",
      sha256: sha256(mobyBuffer),
      license: "Public domain (Moby source); see vendored README",
    },
  },
  dictionary,
  thesaurus: Object.fromEntries(
    Object.entries(relations).map(([term, values]) => [term, [...values].sort()]),
  ),
};

await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `Built runtime index with ${Object.keys(dictionary).length} definitions and ` +
    `${Object.values(payload.thesaurus).reduce((sum, values) => sum + values.length, 0)} relations.`,
);
