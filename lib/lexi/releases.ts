export type LexiRelease = {
  build: string;
  label: string;
  shortLabel: string;
  date: string;
  capabilityIndex: number;
  metric?: string;
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
    capabilityIndex: 8,
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
    capabilityIndex: 9,
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
    capabilityIndex: 18,
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
    capabilityIndex: 100,
    metric: "492.79× semantic availability",
    notes: [
      "Rebuilt question understanding around typed subjects, relations, properties, conditions, quantities, and time.",
      "Added a 590-entity, 3,132-proposition knowledge graph with explicit inheritance, transitive classification, comparison, and derived-location proofs.",
      "Added session memory and passed all 3,211 ordinary-question, reachability, reasoning, conversation, and reference benchmark cases.",
    ],
  },
] as const;

export function releaseImprovement(index: number) {
  if (index <= 0 || index >= LEXI_RELEASES.length) return null;
  const current = LEXI_RELEASES[index].capabilityIndex;
  const previous = LEXI_RELEASES[index - 1].capabilityIndex;
  return ((current - previous) / previous) * 100;
}
