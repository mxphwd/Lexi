import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { verifySource } from "./lib/dv11-ad-pack.mjs";

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, "data/dv11/ad1/source-manifest.json"), "utf8"));
const target = process.env.LEXI_AD1_SOURCE_DIR ?? join(root, ".cache/dv11-ad1-source");
await mkdir(target, { recursive: true });

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

const triples = join(target, "wikidata5m_all_triplet.txt.gz");
const aliases = join(target, "wikidata5m_alias.tar.gz");
try { await verifySource(triples, manifest.source.triples.sha256); } catch { await run("curl", ["-L", "--fail", "--retry", "3", "-o", triples, manifest.source.triples.url]); }
try { await verifySource(aliases, manifest.source.aliases.sha256); } catch { await run("curl", ["-L", "--fail", "--retry", "3", "-o", aliases, manifest.source.aliases.url]); }
await Promise.all([verifySource(triples, manifest.source.triples.sha256), verifySource(aliases, manifest.source.aliases.sha256)]);
await run("tar", ["-xzf", aliases, "-C", target]);
console.log(JSON.stringify({ sourceDirectory: target, triples, entities: join(target, "wikidata5m_entity.txt"), relations: join(target, "wikidata5m_relation.txt"), verified: true }, null, 2));
