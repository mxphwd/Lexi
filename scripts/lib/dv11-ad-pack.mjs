import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { gzipSync } from "node:zlib";

export const normalizeAdText = (value) => String(value ?? "")
  .normalize("NFKC")
  .replace(/[‘’‚‛]/g, "'")
  .replace(/[“”„‟]/g, '"')
  .replace(/[‐‑‒–—―]/g, "-")
  .toLocaleLowerCase("en-US")
  .replace(/[^\p{L}\p{M}\p{N}' -]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const hashBucket = (value, width = 2) => sha256(String(value)).slice(0, width);
export const lexicalBucket = (value) => /^[a-z0-9]/.test(normalizeAdText(value)[0] ?? "") ? normalizeAdText(value)[0] : "_";

export function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function verifySource(path, expectedSha256) {
  const bytes = await readFile(path);
  const actual = sha256(bytes);
  if (actual !== expectedSha256) throw new Error(`Source SHA-256 mismatch for ${path}: ${actual}`);
  return { sizeBytes: bytes.length, sha256: actual };
}

export async function writeJson(root, path, value) {
  await mkdir(dirname(path), { recursive: true });
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  await writeFile(path, bytes);
  return { path: `/${relative(root, path)}`, sha256: sha256(bytes), sizeBytes: bytes.length };
}

export async function writeGzipJson(root, path, value) {
  await mkdir(dirname(path), { recursive: true });
  const decoded = Buffer.from(JSON.stringify(value));
  const bytes = gzipSync(decoded, { level: 9 });
  await writeFile(path, bytes);
  return {
    path: `/${relative(root, path)}`,
    sha256: sha256(bytes),
    sizeBytes: bytes.length,
    decodedSha256: sha256(decoded),
    decodedSizeBytes: decoded.length,
  };
}

function aliasScore(value) {
  const words = value.trim().split(/\s+/);
  const naturalTitle = words.every((word) => /^\p{Lu}[\p{L}\p{M}'-]*$/u.test(word) || /^(?:a|an|and|de|of|the|van|von)$/i.test(word));
  const letters = value.match(/\p{L}/gu)?.length ?? 0;
  const latin = value.match(/[A-Za-z]/g)?.length ?? 0;
  return (naturalTitle ? 25 : 0)
    + (words.length >= 1 && words.length <= 4 ? 30 - Math.abs(words.length - 2) * 3 : -Math.max(0, words.length - 4) * 6)
    + (words.length === 1 ? 20 : words.length === 2 ? Math.min(20, value.length) : 0)
    + (letters && latin / letters >= 0.8 ? 8 : 0)
    + (!/[,()[\]{}]/.test(value) ? 12 : 0)
    + (/^\p{Lu}/u.test(value) ? 8 : 0)
    + (/^[\x20-\x7E]+$/.test(value) ? 20 : 0)
    + (value.length >= 3 && value.length <= 35 ? 10 : 0)
    - (/\b(?:biography|books|comments|history of|portal)\b/i.test(value) ? 24 : 0)
    - (/^(?:a|an|the)\b/i.test(value) ? 12 : 0)
    - (/^[A-Z\d]{2,6}$/.test(value) ? 10 : 0)
    - Math.max(0, value.length - 60);
}

export function selectEntityNames(values, maximumAliases = 8, useContextualSupport = true) {
  const variants = new Map();
  for (const raw of values) {
    const value = String(raw).trim();
    if (value.length < 2 || value.length > 100) continue;
    const normalized = normalizeAdText(value);
    const current = variants.get(normalized);
    if (!current || aliasScore(value) > aliasScore(current)) variants.set(normalized, value);
  }
  const unique = [...variants.values()];
  const base = unique.sort((left, right) => aliasScore(right) - aliasScore(left) || left.length - right.length || left.localeCompare(right, "en-US")).slice(0, Math.max(32, maximumAliases * 4));
  const normalizedUnique = unique.map(normalizeAdText);
  const supportedScore = (value) => {
    const normalized = normalizeAdText(value);
    const boundary = new RegExp(`(?:^|[^\\p{L}\\p{N}])${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^\\p{L}\\p{N}])`, "u");
    const support = normalizedUnique.reduce((sum, candidate) => sum + (candidate === normalized ? 3 : boundary.test(candidate) ? 1 : 0), 0);
    return aliasScore(value) + Math.min(80, support * 4);
  };
  const ranked = useContextualSupport
    ? base.sort((left, right) => supportedScore(right) - supportedScore(left) || aliasScore(right) - aliasScore(left) || left.length - right.length || left.localeCompare(right, "en-US"))
    : base;
  const canonicalName = ranked[0];
  if (!canonicalName) return undefined;
  const aliases = ranked.slice(1).filter((value) => normalizeAdText(value) !== normalizeAdText(canonicalName)).slice(0, maximumAliases);
  return { canonicalName, aliases };
}

export function entityKindFromLabel(value) {
  const label = normalizeAdText(value);
  if (/\b(?:human|person|people|writer|artist|politician|scientist|athlete|actor|composer|inventor)\b/.test(label)) return "person";
  if (/\b(?:country|sovereign state|nation)\b/.test(label)) return "country";
  if (/\b(?:organization|organisation|company|corporation|institution|agency|association|university|school|club|team|government)\b/.test(label)) return "organization";
  if (/\b(?:city|town|village|municipality|island|river|lake|mountain|airport|station|building|location|place|territory)\b/.test(label)) return "place";
  if (/\b(?:region|province|state|county|district|continent)\b/.test(label)) return "region";
  if (/\b(?:animal|plant|species|taxon|organism|bird|mammal|fish|insect|fungus)\b/.test(label)) return "organism";
  if (/\b(?:chemical|compound|element|material|substance|mineral|metal)\b/.test(label)) return "material";
  if (/\b(?:process|phenomenon|reaction|method|procedure|activity|event)\b/.test(label)) return "process";
  if (/\b(?:language|dialect)\b/.test(label)) return "language";
  if (/\b(?:planet|star|moon|asteroid|galaxy|constellation|celestial body)\b/.test(label)) return "celestial-body";
  if (/\b(?:academic discipline|field of study|branch of science|science|mathematics)\b/.test(label)) return "field";
  if (/\b(?:device|tool|vehicle|product|software|work|book|film|song|object|food|structure)\b/.test(label)) return "object";
  return "concept";
}
