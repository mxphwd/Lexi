import type { EntityKind, KnowledgeGraph } from "@/modules/knowledge-graph";
import type { SemanticRelation } from "@/modules/semantic";
import { dv8Normalize, dv8Tokens, lexicalForms } from "./normalize";

export type WordSense = {
  senseId: string;
  alias: string;
  entityId: string;
  canonicalName: string;
  kind: EntityKind;
};

export type ResolvedMention = {
  alias: string;
  startToken: number;
  endToken: number;
  selected?: WordSense;
  senses: WordSense[];
  confidence: number;
  reason: "single-sense" | "contextual-sense" | "ambiguous";
};

type TrieNode = {
  children: Map<string, TrieNode>;
  senses: WordSense[];
};

function node(): TrieNode {
  return { children: new Map(), senses: [] };
}

function expectedKinds(
  input: string,
  relation?: SemanticRelation,
): ReadonlySet<EntityKind> {
  const expected = new Set<EntityKind>();
  if (/\b(?:who|person|inventor|author|founder|scientist|born)\b/.test(input)) {
    expected.add("person");
  }
  if (/\b(?:where|country|city|capital|continent|located|live)\b/.test(input)) {
    expected.add("place");
    expected.add("country");
    expected.add("region");
  }
  if (/\b(?:unit|measure|measured|symbol)\b/.test(input) || relation === "unit") {
    expected.add("unit");
  }
  if (/\b(?:planet|star|moon|space)\b/.test(input)) expected.add("celestial-body");
  if (/\b(?:animal|organism|species|live|eat|legs)\b/.test(input)) expected.add("organism");
  if (relation === "capital" || relation === "country" || relation === "continent") {
    expected.add("country");
    expected.add("place");
  }
  return expected;
}

/**
 * A token trie compiled once at module initialization. DV7 built a regular
 * expression for every alias on every prompt; DV8 walks the input tokens once
 * and preserves every meaning attached to an ambiguous spelling.
 */
export class CompiledLexicalIndex {
  private readonly root = node();
  private readonly exact = new Map<string, WordSense[]>();
  readonly senses: readonly WordSense[];

  constructor(graph: KnowledgeGraph) {
    const senses: WordSense[] = [];
    for (const entity of graph.allEntities()) {
      for (const rawAlias of [entity.name, ...entity.aliases]) {
        for (const alias of lexicalForms(rawAlias)) {
          if (!alias) continue;
          const sense: WordSense = {
            senseId: `${alias}:${entity.id}`,
            alias,
            entityId: entity.id,
            canonicalName: entity.name,
            kind: entity.kind,
          };
          const existing = this.exact.get(alias) ?? [];
          if (!existing.some((candidate) => candidate.entityId === entity.id)) {
            existing.push(sense);
            this.exact.set(alias, existing);
            senses.push(sense);
          }
        }
      }
    }

    for (const [alias, aliasSenses] of this.exact) {
      let cursor = this.root;
      for (const token of dv8Tokens(alias)) {
        const child = cursor.children.get(token) ?? node();
        cursor.children.set(token, child);
        cursor = child;
      }
      cursor.senses.push(...aliasSenses);
    }
    this.senses = senses;
  }

  resolveExact(value: string, relation?: SemanticRelation): ResolvedMention | undefined {
    const aliases = lexicalForms(value);
    const senses = aliases.flatMap((alias) => this.exact.get(alias) ?? []);
    return this.choose(value, 0, dv8Tokens(value).length, senses, relation);
  }

  resolveMentions(value: string, relation?: SemanticRelation): ResolvedMention[] {
    const normalized = dv8Normalize(value);
    const tokens = dv8Tokens(normalized);
    const candidates: ResolvedMention[] = [];

    for (let start = 0; start < tokens.length; start += 1) {
      let cursor: TrieNode | undefined = this.root;
      for (let end = start; end < tokens.length && cursor; end += 1) {
        cursor = cursor.children.get(tokens[end]);
        if (!cursor) break;
        if (cursor.senses.length) {
          const chosen = this.choose(
            normalized,
            start,
            end + 1,
            cursor.senses,
            relation,
          );
          if (chosen) candidates.push(chosen);
        }
      }
    }

    candidates.sort((left, right) => {
      const lengthDifference =
        right.endToken - right.startToken - (left.endToken - left.startToken);
      return left.startToken - right.startToken || lengthDifference;
    });
    const occupied = new Set<number>();
    const selected: ResolvedMention[] = [];
    for (const candidate of candidates) {
      const range = Array.from(
        { length: candidate.endToken - candidate.startToken },
        (_, index) => candidate.startToken + index,
      );
      if (range.some((index) => occupied.has(index))) continue;
      range.forEach((index) => occupied.add(index));
      selected.push(candidate);
    }
    return selected.sort((left, right) => left.startToken - right.startToken);
  }

  private choose(
    input: string,
    startToken: number,
    endToken: number,
    candidateSenses: readonly WordSense[],
    relation?: SemanticRelation,
  ): ResolvedMention | undefined {
    const senses = [...new Map(candidateSenses.map((sense) => [sense.entityId, sense])).values()];
    if (!senses.length) return undefined;
    const alias = dv8Tokens(input).slice(startToken, endToken).join(" ");
    if (senses.length === 1) {
      return {
        alias,
        startToken,
        endToken,
        selected: senses[0],
        senses,
        confidence: 1,
        reason: "single-sense",
      };
    }

    const expected = expectedKinds(dv8Normalize(input), relation);
    const compatible = senses.filter((sense) => expected.has(sense.kind));
    if (compatible.length === 1) {
      return {
        alias,
        startToken,
        endToken,
        selected: compatible[0],
        senses,
        confidence: 0.92,
        reason: "contextual-sense",
      };
    }
    return {
      alias,
      startToken,
      endToken,
      senses,
      confidence: 0,
      reason: "ambiguous",
    };
  }

  stats() {
    const ambiguousAliases = [...this.exact.values()].filter(
      (senses) => new Set(senses.map((sense) => sense.entityId)).size > 1,
    ).length;
    return {
      aliases: this.exact.size,
      senses: this.senses.length,
      ambiguousAliases,
    };
  }
}
