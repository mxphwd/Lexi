export type LexiRelease = {
  build: string;
  label: string;
  shortLabel: string;
  date: string;
  capabilityIndex: number;
  metric?: string;
  measurements?: readonly {
    label: string;
    value: string;
  }[];
  notes: readonly string[];
};

/**
 * The capability index is an authored 0–100 development index, not an external
 * benchmark. It combines deterministic response reach, contextual precision,
 * lexical coverage, and model transparency so unlike early builds can share
 * one readable historical curve.
 */
export const LEXI_RELEASES: readonly LexiRelease[] = [
  {
    build: "260720-1A",
    label: "Pre-build 260720-1A",
    shortLabel: "260720-1A",
    date: "20 July 2026",
    capabilityIndex: 1,
    metric: "4 core modules",
    notes: [
      "Established the Search, Context, Connect, and Structure module path.",
      "Added the first deterministic example-context responses.",
      "Introduced an inspectable response trace and the zero-generative-model boundary.",
    ],
  },
  {
    build: "260721-0A",
    label: "Pre-build 260721-0A",
    shortLabel: "260721-0A",
    date: "21 July 2026",
    capabilityIndex: 2,
    metric: "4,180 recorded examples",
    notes: [
      "Added an independent foundational phrase gate for greetings, identity, age, thanks, and farewells.",
      "Expanded basic-conversation and daily-life coverage to 4,180 recorded examples.",
      "Added connected-request handling and complete Wordset definition lookup.",
    ],
  },
  {
    build: "260730-DV3",
    label: "Pre-build 260730-DV3",
    shortLabel: "DV3",
    date: "30 July 2026",
    capabilityIndex: 3,
    metric: "17,861 direct constructions",
    notes: [
      "Introduced the Extended Pack as an authored direct-answer layer.",
      "Mapped 122 subjects through 434 recognized names and semantic question frames.",
      "Reduced dictionary and example-corpus dependence for known subjects.",
    ],
  },
  {
    build: "260730-DV4",
    label: "Pre-build 260730-DV4",
    shortLabel: "DV4",
    date: "30 July 2026",
    capabilityIndex: 5,
    metric: "3.99× availability",
    notes: [
      "Added 347 linguistic, conversational, and reference-resolution features.",
      "Made singular and paired-subject follow-ups precise while refusing ambiguous antecedents.",
      "Added polite rewrites, answer styles, summaries, learning paths, and relationship-aware comparisons.",
    ],
  },
  {
    build: "260730-DV5",
    label: "Pre-build 260730-DV5",
    shortLabel: "DV5",
    date: "30 July 2026",
    capabilityIndex: 6,
    metric: "5 release milestones",
    notes: [
      "Added an interactive, version-linked capability history inside Lexi.",
      "Made quantitative gains and release-specific changes directly inspectable.",
      "Established a permanent release-entry requirement for every future model version.",
    ],
  },
  {
    build: "260730-DV6",
    label: "Pre-build 260730-DV6",
    shortLabel: "DV6",
    date: "30 July 2026",
    capabilityIndex: 12,
    metric: "7.02× availability",
    notes: [
      "Expanded the direct layer to 500,347 constructions across 222 subjects and 1,000 recognized names.",
      "Added exactly 800 linguistic, reasoning, conversation, reference, and semantic-routing features.",
      "Introduced 100 technical contexts, 100 deterministic reasoning patterns, and 180 simple-conversation patterns.",
    ],
  },
  {
    build: "260731-DV7",
    label: "Pre-build 260731-DV7",
    shortLabel: "DV7",
    date: "31 July 2026",
    capabilityIndex: 55,
    metric: "492.79× semantic availability",
    notes: [
      "Rebuilt question understanding around typed subjects, relations, properties, conditions, quantities, and time.",
      "Added a 590-entity, 3,132-proposition knowledge graph with explicit inheritance, transitive classification, comparison, and derived-location proofs.",
      "Added session memory and passed all 3,211 ordinary-question, reachability, reasoning, conversation, and reference benchmark cases.",
    ],
  },
  {
    build: "260801-DV8",
    label: "Pre-build 260801-DV8",
    shortLabel: "DV8",
    date: "1 August 2026",
    capabilityIndex: 72,
    metric: "4,124-case blind benchmark",
    measurements: [
      { label: "Knowledge", value: "100.0%" },
      { label: "Language", value: "100.0%" },
      { label: "Reasoning", value: "100.0%" },
      { label: "Dialogue", value: "100.0%" },
      { label: "Precision", value: "100.0%" },
      { label: "Latency p95", value: "0.30 ms" },
    ],
    notes: [
      "Replaced direct question-to-relation routing with typed query plans, compiled word senses, normalized facts, and an indexed execution engine.",
      "Added forward and inverse joins, filters, aggregates, comparisons, explicit negation, quantifiers, conditions, time checks, unit conversion, and calibrated abstention.",
      "Expanded session state around answer propositions and conversational goals, then passed all 4,124 held-out cases plus 120 proposition-aware dialogue sessions.",
      "Measured 1.0467× total success over the frozen DV7 path on the same suite; no 1,000× claim is made because the evidence does not support it.",
    ],
  },
  {
    build: "260802-DV9",
    label: "Pre-build 260802-DV9",
    shortLabel: "DV9",
    date: "2 August 2026",
    capabilityIndex: 100,
    metric: "800,000 validated atomic facts",
    measurements: [
      { label: "Entities", value: "323,853" },
      { label: "Senses", value: "163,274" },
      { label: "Plan examples", value: "100,000" },
      { label: "Dialogue", value: "40,000" },
      { label: "Held-out plans", value: "100.0%" },
      { label: "Parser p95", value: "0.004 ms" },
    ],
    notes: [
      "Added a provenance-bearing lexical data layer with 323,853 entities, 163,274 explicit senses, 3,200 typed relation profiles, and 800,000 schema-validated atomic facts.",
      "Compiled 100,000 compositional query-plan examples, 1,100 inspectable inference-rule instances, and 40,000 proposition-aware dialogue scenarios without adding finished-answer constructions.",
      "Passed all 40,000 isolated source-derived language cases and a 1,000-case end-to-end lexical sample; these cases are synthetic held-out checks, not user-reported failures.",
      "Classified 636,726 rows as source-attested and 163,274 as mechanically derived. DV9 does not mislabel either class as newly independently reviewed general knowledge.",
    ],
  },
] as const;

export function releaseImprovement(index: number) {
  if (index <= 0 || index >= LEXI_RELEASES.length) return null;
  const current = LEXI_RELEASES[index].capabilityIndex;
  const previous = LEXI_RELEASES[index - 1].capabilityIndex;
  return ((current - previous) / previous) * 100;
}
