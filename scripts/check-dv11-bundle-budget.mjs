import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";

const budget = JSON.parse(await readFile(resolve("data/dv11/bundle-budgets.json"), "utf8"));
const clientRoots = [resolve("dist/client"), resolve(".vinext/client"), resolve(".next/static")];

async function collect(path) {
  const files = [];
  try {
    for (const name of await readdir(path)) {
      const child = resolve(path, name);
      const info = await stat(child);
      if (info.isDirectory()) files.push(...await collect(child));
      else if (/\.(?:js|mjs)$/i.test(name)) files.push({ path: child, bytes: info.size });
    }
  } catch {}
  return files;
}

async function readManifest() {
  for (const path of [resolve("dist/client/.vite/manifest.json"), resolve(".vinext/client/.vite/manifest.json")]) {
    try {
      return { path, value: JSON.parse(await readFile(path, "utf8")) };
    } catch {}
  }
  return null;
}

function initialFilesFromManifest(manifest) {
  const initial = new Set();
  const entries = Object.values(manifest).filter((entry) => entry.isEntry);
  const byKey = manifest;
  const visit = (entry) => {
    if (!entry || initial.has(entry.file)) return;
    initial.add(entry.file);
    for (const imported of entry.imports ?? []) visit(byKey[imported]);
  };
  for (const entry of entries) visit(entry);
  return initial;
}

const files = (await Promise.all(clientRoots.map(collect))).flat();
const unique = [...new Map(files.map((file) => [file.path, file])).values()];
if (!unique.length) throw new Error("No built client JavaScript chunks were found. Run the build before the bundle budget gate.");

const manifestResult = await readManifest();
if (!manifestResult) throw new Error("No client build manifest was found; initial and lazy chunks cannot be classified safely.");
const initialRelativeFiles = initialFilesFromManifest(manifestResult.value);
const clientRoot = resolve(manifestResult.path, "../..");
const initialPaths = new Set([...initialRelativeFiles].map((file) => resolve(clientRoot, file)));
const initial = unique.filter((file) => initialPaths.has(file.path));
const lazy = unique.filter((file) => !initialPaths.has(file.path));
const sortedInitial = [...initial].sort((left, right) => right.bytes - left.bytes);
const sortedLazy = [...lazy].sort((left, right) => right.bytes - left.bytes);
const largestInitial = sortedInitial[0] ?? { path: "none", bytes: 0 };
const largestLazy = sortedLazy[0] ?? { path: "none", bytes: 0 };
const totalClientBytes = unique.reduce((sum, file) => sum + file.bytes, 0);
const initialBytes = initial.reduce((sum, file) => sum + file.bytes, 0);
const lazyBytes = lazy.reduce((sum, file) => sum + file.bytes, 0);
const violations = [];

if (largestInitial.bytes > budget.maximumInitialChunkBytes) {
  violations.push(`Largest initial chunk ${relative(".", largestInitial.path)} is ${largestInitial.bytes} bytes.`);
}
if (largestLazy.bytes > budget.maximumLazyChunkBytes) {
  violations.push(`Largest lazy chunk ${relative(".", largestLazy.path)} is ${largestLazy.bytes} bytes.`);
}
if (totalClientBytes > budget.maximumTotalClientJavaScriptBytes) {
  violations.push(`Total client JavaScript is ${totalClientBytes} bytes.`);
}
if (budget.largeKnowledgeDataMustBeExternal && !lazy.some((file) => /(?:engine|dv11)/i.test(file.path))) {
  violations.push("The semantic engine was not emitted as a lazy client chunk.");
}

console.log(JSON.stringify({
  files: unique.length,
  initialFiles: initial.length,
  lazyFiles: lazy.length,
  totalClientBytes,
  initialBytes,
  lazyBytes,
  largestInitial: { file: relative(".", largestInitial.path), bytes: largestInitial.bytes },
  largestLazy: { file: relative(".", largestLazy.path), bytes: largestLazy.bytes },
  budgets: budget,
  passed: violations.length === 0,
  violations,
}, null, 2));
if (violations.length) process.exitCode = 1;
