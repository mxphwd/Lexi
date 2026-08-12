import { appendFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const input = await new Promise((resolveInput) => {
  let text = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { text += chunk; });
  process.stdin.on("end", () => resolveInput(text));
});
function redact(value) {
  if (typeof value === "string") {
    return value
      .replace(/[\w.+-]+@[\w.-]+/g, "[redacted-email]")
      .replace(/\b(?:\+?\d[\d ()-]{7,}\d)\b/g, "[redacted-phone]")
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-ip]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redact(item)]));
  return value;
}

const candidate = redact(JSON.parse(input));
for (const required of ["prompt", "expected", "observedOutput", "conversationState", "failureClass", "provenance"]) if (candidate[required] === undefined) throw new Error(`Missing ${required}.`);
candidate.provenance.consent = "evaluation-only";
candidate.immutableHash = createHash("sha256").update(JSON.stringify(candidate)).digest("hex");
const directory = resolve(".local/dv11-failure-inbox");
await mkdir(directory, { recursive: true });
const path = resolve(directory, `${new Date().toISOString().slice(0, 10)}.jsonl`);
await appendFile(path, `${JSON.stringify(candidate)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ captured: true, reviewRequired: true, path, immutableHash: candidate.immutableHash, note: "Local opt-in inbox only; independent review is required before evaluation import." }, null, 2));
