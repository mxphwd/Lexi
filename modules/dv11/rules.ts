export type Dv11RuleFamily =
  | "inverse" | "transitive" | "inheritance" | "containment" | "membership"
  | "conversion" | "causal-chain" | "comparison" | "conditional" | "negation" | "quantifier";

export type Dv11RuleType = "entity" | "concept" | "person" | "place" | "organization" | "text" | "number" | "quantity" | "time" | "boolean";

export type Dv11CompiledRule = {
  id: string;
  family: Dv11RuleFamily;
  domain: Dv11RuleType;
  range: Dv11RuleType;
  variables: readonly ["subject", "relation", "object"];
  premises: readonly ({ kind: "proposition"; subject: "subject"; relation: "relation"; object: "object" } | { kind: "schema"; property: Dv11RuleFamily })[];
  conclusion: { kind: "bound-proposition"; family: Dv11RuleFamily };
  maximumDepth: number;
  cyclePolicy: "reject-repeated-binding";
  conflictPolicy: "preserve-and-calibrate";
};

const families: readonly Dv11RuleFamily[] = ["inverse", "transitive", "inheritance", "containment", "membership", "conversion", "causal-chain", "comparison", "conditional", "negation", "quantifier"];
const types: readonly Dv11RuleType[] = ["entity", "concept", "person", "place", "organization", "text", "number", "quantity", "time", "boolean"];

export const compiledDv11Rules: readonly Dv11CompiledRule[] = families.flatMap((family) => types.flatMap((domain) => types.map((range) => ({
  id: `dv11-rule:${family}:${domain}:${range}`,
  family,
  domain,
  range,
  variables: ["subject", "relation", "object"] as const,
  premises: [{ kind: "proposition", subject: "subject", relation: "relation", object: "object" }, { kind: "schema", property: family }] as const,
  conclusion: { kind: "bound-proposition", family } as const,
  maximumDepth: family === "transitive" || family === "causal-chain" ? 8 : 4,
  cyclePolicy: "reject-repeated-binding" as const,
  conflictPolicy: "preserve-and-calibrate" as const,
}))));

const index = new Map(compiledDv11Rules.map((rule) => [`${rule.family}\0${rule.domain}\0${rule.range}`, rule]));

export function dv11Rule(family: Dv11RuleFamily, domain: Dv11RuleType = "entity", range: Dv11RuleType = "entity") {
  return index.get(`${family}\0${domain}\0${range}`)!;
}

export function dv11RuleStats() {
  return { compiledRules: compiledDv11Rules.length, families: families.length, domainTypes: types.length, rangeTypes: types.length, maximumProofDepth: 8 };
}
