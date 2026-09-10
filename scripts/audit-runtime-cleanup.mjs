import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import ts from "typescript";

const root = process.cwd();
const extensions = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];
const ignored = new Set([".git", "node_modules", "dist", ".vinext", ".wrangler", "github-pages-assets", "data", "public", "docs"]);
const retired = [
  "core/basic-phrases", "lib/lexi/historical-engine.ts", "modules/benchmark",
  "modules/connect", "modules/context", "modules/dictionary", "modules/discourse",
  "modules/dv7", "modules/dv8", "modules/dv9", "modules/dv10", "modules/dv11",
  "modules/memory", "modules/proposition", "modules/structure", "worker/lexi-resources.ts",
  "data/benchmarks", "data/dv9", "data/dv10", "data/dv11", "data/example-contexts",
  "data/lexicon/runtime-index.json", "data/lexicon/vendor/moby/words.txt",
  "data/lexicon/vendor/wordset/allwords_wordset.json.gz", "public/og.png",
  "public/lexicon/wordset-dictionary.json.gz",
];

function filesBelow(directory, useIgnores = true) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (useIgnores && ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(absolute, useIgnores));
    else result.push(absolute);
  }
  return result;
}

const sources = filesBelow(root).filter(file => extensions.includes(path.extname(file)));
const sourceSet = new Set(sources.map(path.normalize));
function resolve(from, specifier) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return undefined;
  const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(from), specifier);
  for (const candidate of [base, ...extensions.map(ext => base + ext), ...extensions.map(ext => path.join(base, "index" + ext))]) {
    const normalized = path.normalize(candidate);
    if (sourceSet.has(normalized)) return normalized;
  }
}

const graph = new Map();
for (const file of sources) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const dependencies = new Set();
  function walk(node) {
    let specifier;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifier = node.moduleSpecifier.text;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) specifier = node.arguments[0].text;
    const dependency = specifier ? resolve(file, specifier) : undefined;
    if (dependency) dependencies.add(dependency);
    ts.forEachChild(node, walk);
  }
  walk(source); graph.set(file, [...dependencies]);
}

const roots = ["app/page.tsx", "app/layout.tsx", "worker/index.ts", "github-pages/main.tsx"].map(file => path.join(root, file));
const reachable = new Set();
function visit(file) { if (reachable.has(file)) return; reachable.add(file); for (const dependency of graph.get(file) ?? []) visit(dependency); }
roots.forEach(visit);

const stale = retired.filter(relative => fs.existsSync(path.join(root, relative)));
const forbiddenRuntime = [...reachable].map(file => path.relative(root, file)).filter(file => retired.some(item => file === item || file.startsWith(item + "/")));

const catalogPath = path.join(root, "public/dv12/catalog.json.gz");
const catalog = JSON.parse(zlib.gunzipSync(fs.readFileSync(catalogPath)));
const descriptors = [
  ...Object.values(catalog.world.sourceShards),
  ...Object.values(catalog.world.indexes.alias.shards),
  ...Object.values(catalog.world.indexes.subject.shards),
  ...Object.values(catalog.world.indexes.object.shards),
  catalog.world.indexes.predicate,
  ...Object.values(catalog.lexical.indexes.alias.shards),
  ...catalog.lexical.packages.flatMap(pack => pack.sourceShards),
  ...catalog.normalized,
];
const livePaths = new Set(["/dv12/catalog.json.gz", ...descriptors.map(item => item.path)]);
let liveAssetBytes = 0;
const invalidAssets = [];
for (const descriptor of descriptors) {
  const file = path.join(root, "public", descriptor.path.replace(/^\//, ""));
  if (!fs.existsSync(file)) { invalidAssets.push(descriptor.path + ":missing"); continue; }
  const bytes = fs.readFileSync(file); liveAssetBytes += bytes.length;
  if (bytes.length !== descriptor.sizeBytes || crypto.createHash("sha256").update(bytes).digest("hex") !== descriptor.sha256) invalidAssets.push(descriptor.path + ":integrity");
}
const allowedStatic = new Set(["/og-v2.png", "/lexicon/ATTRIBUTION.txt", "/lexicon/WORDSET-LICENSE.txt"]);
const unreferencedPublic = filesBelow(path.join(root, "public"), false)
  .map(file => "/" + path.relative(path.join(root, "public"), file).split(path.sep).join("/"))
  .filter(file => !livePaths.has(file) && !allowedStatic.has(file));

const report = {
  passed: !stale.length && !forbiddenRuntime.length && !invalidAssets.length && !unreferencedPublic.length,
  runtime: { roots: roots.map(file => path.relative(root, file)), reachableSourceFiles: reachable.size, forbiddenRuntime },
  assets: { referencedFiles: livePaths.size, referencedBytes: liveAssetBytes + fs.statSync(catalogPath).size, invalidAssets, unreferencedPublic },
  retiredPathsRemaining: stale,
};
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
