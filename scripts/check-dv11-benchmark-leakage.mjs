import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { loadDv11Jsonl } from "../modules/benchmark/dv11.ts";

const root = resolve(".");
const evaluationRoot = resolve("data/dv11/evaluation");
const manifest = JSON.parse(await readFile(resolve(evaluationRoot, "manifest.json"), "utf8"));
const scannedRoots = ["app", "components", "core", "lib", "modules", "public", "data/example-contexts", "data/dv9/packs", "data/dv11/packages"];
const extensions = /\.(?:ts|tsx|js|mjs|json|jsonl|md|txt|csv)$/i;

async function filesUnder(path) {
  const found = [];
  try {
    for (const name of await readdir(path)) {
      const child = resolve(path, name);
      const info = await stat(child);
      if (info.isDirectory()) found.push(...await filesUnder(child));
      else if (extensions.test(name)) found.push(child);
    }
  } catch {}
  return found;
}

const rows = [
  ...await loadDv11Jsonl(resolve(evaluationRoot, "real-user-failures.jsonl")),
];
const signatures = rows.flatMap((row) => [row.prompt, row.expected.canonical, ...(row.expected.aliases ?? [])])
  .filter((value) => typeof value === "string" && value.trim().length >= 16)
  .map((value) => value.trim().toLocaleLowerCase("en-US"));
const files = (await Promise.all(scannedRoots.map((path) => filesUnder(resolve(root, path))))).flat();
const overlaps = [];
const forbiddenImports = [];
const fileHashMismatches = [];
for (const [name, expected] of Object.entries(manifest.files ?? {})) {
  const bytes = await readFile(resolve(evaluationRoot, name));
  const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (actual !== expected) fileHashMismatches.push({ file: name, expected, actual });
}
for (const file of files) {
  const text = (await readFile(file, "utf8")).toLocaleLowerCase("en-US");
  for (const signature of signatures) if (text.includes(signature)) overlaps.push({ file: relative(root, file), signatureHash: createHash("sha256").update(signature).digest("hex") });
  const relativeFile = relative(root, file);
  if (/^(?:app|components|core|lib|modules)\//.test(relativeFile)
    && !relativeFile.startsWith("modules/benchmark/")
    && /data\/dv11\/evaluation|real-user-failures\.jsonl|ordinary-questions\.jsonl/.test(text)) {
    forbiddenImports.push(relativeFile);
  }
}
const manifestBytes = await readFile(resolve(evaluationRoot, "manifest.json"));
const rowCountMismatch = rows.length !== manifest.realFailureRows;
const report = { scannedFiles: files.length, realEvaluationRows: rows.length, signatures: signatures.length, overlaps, forbiddenImports, fileHashMismatches, rowCountMismatch, manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"), passed: overlaps.length === 0 && forbiddenImports.length === 0 && fileHashMismatches.length === 0 && !rowCountMismatch };
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
