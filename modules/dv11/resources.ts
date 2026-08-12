import { dv11NormalizeText } from "./normalize";
import type { Dv11KnowledgePackage, Dv11QueryPlan, Dv11ResourceRequest, Dv11ResourceResponse } from "./types";

export interface Dv11KnowledgeResourceClient {
  resolve(plan: Dv11QueryPlan, loadedPackageIds: readonly string[], signal?: AbortSignal): Promise<Dv11ResourceResponse>;
}

function candidates(plan: Dv11QueryPlan): Omit<Dv11ResourceRequest, "schemaVersion" | "normalized" | "loadedPackageIds"> {
  const lexicalTerms = plan.clauses.flatMap((clause) => clause.lexicalRequest?.term ? [clause.lexicalRequest.term] : []);
  const unresolvedMentions = plan.clauses.flatMap((clause) => clause.unresolvedSlots.length
    ? clause.mentions.filter((mention) => !mention.selectedEntityId).map((mention) => mention.span.text)
    : []);
  const stop = new Set(["a", "an", "and", "are", "as", "at", "be", "by", "can", "did", "do", "does", "for", "from", "has", "have", "how", "in", "is", "it", "its", "me", "of", "on", "or", "tell", "the", "their", "this", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with", "would", "you"]);
  const relationWords = new Set(["author", "border", "cause", "contain", "create", "created", "discover", "discovered", "found", "founded", "invent", "invented", "locate", "located", "make", "made", "produce", "produced", "write", "writes", "written", "wrote"]);
  const words = dv11NormalizeText(plan.normalized).match(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'-]*/gu) ?? [];
  const phrases: string[] = [];
  for (let width = Math.min(5, words.length); width >= 1; width -= 1) {
    for (let start = 0; start + width <= words.length; start += 1) {
      const slice = words.slice(start, start + width);
      if (slice.every((word) => stop.has(word))) continue;
      if (width === 1 && relationWords.has(slice[0])) continue;
      const phrase = slice.join(" ");
      if (phrase.length >= 2) phrases.push(phrase);
    }
  }
  return {
    aliases: [...new Set([...lexicalTerms, ...unresolvedMentions, ...phrases].map(dv11NormalizeText).filter(Boolean))].slice(0, 96),
    entityIds: [...new Set(plan.clauses.flatMap((clause) => clause.mentions.flatMap((mention) => mention.selectedEntityId ? [mention.selectedEntityId] : [])))].slice(0, 32),
    senseIds: [...new Set(plan.clauses.flatMap((clause) => clause.mentions.flatMap((mention) => mention.selectedSenseId ? [mention.selectedSenseId] : [])))].slice(0, 32),
    predicates: [...new Set(plan.clauses.flatMap((clause) => clause.patterns.map((pattern) => String(pattern.relation))))].slice(0, 32),
    domains: [...new Set(plan.clauses.flatMap((clause) => clause.mentions.flatMap((mention) => mention.senses.flatMap((sense) => sense.domains))))].slice(0, 16),
  };
}

function validateResponse(value: unknown): Dv11ResourceResponse {
  if (!value || typeof value !== "object") throw new Error("DV11_RESOURCE_RESPONSE_INVALID");
  const response = value as Partial<Dv11ResourceResponse>;
  if (response.schemaVersion !== 1 || !Array.isArray(response.packages) || !response.matched || !response.service) throw new Error("DV11_RESOURCE_RESPONSE_INVALID");
  return response as Dv11ResourceResponse;
}

export class Dv11HttpKnowledgeResourceClient implements Dv11KnowledgeResourceClient {
  constructor(readonly endpoint = "/api/lexi/resources", readonly timeoutMilliseconds = 8_000) {}

  async resolve(plan: Dv11QueryPlan, loadedPackageIds: readonly string[], signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort("timeout"), this.timeoutMilliseconds);
    const request: Dv11ResourceRequest = { schemaVersion: 1, normalized: plan.normalized, ...candidates(plan), loadedPackageIds: [...loadedPackageIds] };
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`DV11_RESOURCE_HTTP_${response.status}`);
      return validateResponse(await response.json());
    } catch (error) {
      if (signal?.aborted) throw new DOMException("Knowledge resource loading was canceled.", "AbortError");
      if (controller.signal.aborted) throw new Error(`DV11_RESOURCE_TIMEOUT:${this.timeoutMilliseconds}`);
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
}

export class Dv11StaticKnowledgeResourceClient implements Dv11KnowledgeResourceClient {
  constructor(private readonly resolver: (plan: Dv11QueryPlan, loadedPackageIds: readonly string[], signal?: AbortSignal) => Promise<Dv11ResourceResponse>) {}
  resolve(plan: Dv11QueryPlan, loadedPackageIds: readonly string[], signal?: AbortSignal) { return this.resolver(plan, loadedPackageIds, signal); }
}

export function createDefaultDv11ResourceClient(): Dv11KnowledgeResourceClient | undefined {
  return typeof window === "undefined" ? undefined : new Dv11HttpKnowledgeResourceClient();
}

export function resourcePackageBytes(pack: Dv11KnowledgePackage) {
  return new TextEncoder().encode(JSON.stringify(pack)).byteLength;
}
