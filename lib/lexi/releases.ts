export type LexiRelease = {
  build: string;
  label: string;
  shortLabel: string;
  extensionLevel?: number;
  date: string;
  capabilityIndex: number;
  metric?: string;
  focus: readonly string[];
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
    focus: ["Core pipeline", "Deterministic", "Inspectable"],
    notes: [
      "Established Search, Context, Connect, and Structure as Lexi’s first mechanical pipeline.",
      "It also introduced deterministic example matching and an inspectable response trace.",
    ],
  },
  {
    build: "260721-0A",
    label: "Pre-build 260721-0A",
    shortLabel: "260721-0A",
    date: "21 July 2026",
    capabilityIndex: 2,
    metric: "4,180 recorded examples",
    focus: ["Conversation", "Definitions", "Connections"],
    notes: [
      "Added a foundational phrase gate and expanded daily conversation to 4,180 examples.",
      "Connected requests and full Wordset definitions made basic answers more dependable.",
    ],
  },
  {
    build: "260730-DV3",
    label: "Pre-build 260730-DV3",
    shortLabel: "DV3",
    date: "30 July 2026",
    capabilityIndex: 3,
    metric: "17,861 direct constructions",
    focus: ["Extended pack", "122 subjects", "Direct answers"],
    notes: [
      "Introduced the Extended Pack with 17,861 direct constructions.",
      "It mapped 122 subjects and 434 names without requiring corpus lookup for every answer.",
    ],
  },
  {
    build: "260730-DV4",
    label: "Pre-build 260730-DV4",
    shortLabel: "DV4",
    date: "30 July 2026",
    capabilityIndex: 5,
    metric: "347 language features",
    focus: ["Follow-ups", "Rewrites", "Comparisons"],
    notes: [
      "Added 347 language and dialogue features; the former 3.99× figure counted constructions, not independently measured answers.",
      "Follow-ups, polite rewrites, summaries, and comparisons became more precise.",
    ],
  },
  {
    build: "260730-DV5",
    label: "Pre-build 260730-DV5",
    shortLabel: "DV5",
    date: "30 July 2026",
    capabilityIndex: 6,
    metric: "5 release milestones",
    focus: ["Release graph", "Measurements", "History"],
    notes: [
      "Made Lexi’s development history interactive and measurable.",
      "Every future model release gained a permanent graph point and inspectable update record.",
    ],
  },
  {
    build: "260730-DV6",
    label: "Pre-build 260730-DV6",
    shortLabel: "DV6",
    date: "30 July 2026",
    capabilityIndex: 12,
    metric: "500,347 constructions",
    focus: ["800 features", "Reasoning", "Technical"],
    notes: [
      "Expanded Lexi to 500,347 constructions and exactly 800 linguistic features.",
      "Technical contexts and deterministic reasoning expanded the catalogs; the former availability multiplier was not a public-use measurement.",
    ],
  },
  {
    build: "260731-DV7",
    label: "Pre-build 260731-DV7",
    shortLabel: "DV7",
    date: "31 July 2026",
    capabilityIndex: 55,
    metric: "3,132 seed propositions",
    focus: ["Typed meaning", "Knowledge graph", "Memory"],
    notes: [
      "Rebuilt understanding around typed relations, conditions, quantities, and time.",
      "Added a 3,132-proposition knowledge graph and session memory; combinatorial semantic-reach totals were not measured answer rates.",
    ],
  },
  {
    build: "260801-DV8",
    label: "Pre-build 260801-DV8",
    shortLabel: "DV8",
    date: "1 August 2026",
    capabilityIndex: 72,
    metric: "4,124 generated checks",
    focus: ["Query plans", "Execution", "Calibration"],
    measurements: [
      { label: "Knowledge", value: "100.0%" },
      { label: "Language", value: "100.0%" },
      { label: "Reasoning", value: "100.0%" },
      { label: "Dialogue", value: "100.0%" },
      { label: "Precision", value: "100.0%" },
      { label: "Latency p95", value: "0.30 ms" },
    ],
    notes: [
      "Replaced direct routing with typed query plans, word senses, indexed facts, and compositional execution.",
      "The 4,124 checks were generated reachability diagnostics, not an independently authored blind benchmark.",
    ],
  },
  {
    build: "260802-DV9",
    label: "Pre-build 260802-DV9",
    shortLabel: "DV9",
    date: "2 August 2026",
    capabilityIndex: 100,
    metric: "800,000 lexical claims",
    focus: ["Atomic facts", "Word senses", "Typed data"],
    measurements: [
      { label: "Entities", value: "323,853" },
      { label: "Senses", value: "163,274" },
      { label: "Plan examples", value: "100,000" },
      { label: "Dialogue", value: "40,000" },
      { label: "Held-out plans", value: "100.0%" },
      { label: "Parser p95", value: "0.004 ms" },
    ],
    notes: [
      "Added 800,000 largely lexical claims, 323,853 records, and 163,274 explicit senses; these are not equivalent to world-question coverage.",
      "Query-plan examples, inference rules, and dialogue scenarios formed Lexi’s large typed data layer.",
    ],
  },
  {
    build: "260811-DV10",
    label: "Pre-build 260811-DV10",
    shortLabel: "DV10",
    date: "11 August 2026",
    capabilityIndex: 100,
    metric: "2,500 generated proxy cases",
    focus: ["Unified path", "Failure set", "Proof"],
    measurements: [
      { label: "Factual knowledge", value: "0.0%" },
      { label: "Language route", value: "35.0%" },
      { label: "Reasoning", value: "0.0%" },
      { label: "Dialogue", value: "100.0%" },
      { label: "Precision probes", value: "100.0%" },
      { label: "Sense selection", value: "100.0%" },
      { label: "Latency p95", value: "120.48 ms" },
    ],
    notes: [
      "Unified plans, reviewed propositions, graph reasoning, dialogue goals, and proof in one execution path.",
      "The frozen 2,500-case proxy set exposed weaknesses; it was not a collection of genuine user failures.",
    ],
  },
  {
    build: "260812-DV11",
    label: "Pre-build 260812-DV11",
    shortLabel: "DV11",
    extensionLevel: 1,
    date: "12 August 2026",
    capabilityIndex: 100,
    metric: "719,949 packaged propositions",
    focus: ["One contract", "Worker retrieval", "Loadable packs"],
    measurements: [
      { label: "World facts", value: "719,949" },
      { label: "Entities", value: "506,655" },
      { label: "Aliases", value: "1,528,693" },
      { label: "Predicates", value: "199" },
      { label: "Domain packages", value: "10" },
      { label: "Physical shards", value: "2,302" },
      { label: "Alias combinations (not examples)", value: "29,640" },
      { label: "Dialogue frames", value: "6" },
    ],
    notes: [
      "Unified Lexi around one typed request-to-proof contract and moved large knowledge retrieval behind the Worker.",
      "The +1 extension packaged 719,949 propositions across ten domains; packaged totals do not describe currently loaded or successfully answerable facts.",
    ],
  },
  {
    build:"260904-DV12",label:"Pre-build 260904-DV12",shortLabel:"DV12",date:"4 September 2026",
    capabilityIndex:100,metric:"256 bounded alias buckets",
    focus:["Server execution","Traceable reasoning","Honest measurement"],
    notes:[
      "Rebuilt the active execution path around typed plans, transactional dialogue, and server-side evidence retrieval.",
      "Added executable packages, arithmetic and temporal safeguards; independent answerability and RC readiness remain unverified."
    ],
    measurements:[{label:"Alias buckets",value:"256"},{label:"Independent evaluation rows",value:"0"},{label:"Public answerability",value:"Unmeasured"},{label:"RC gate",value:"Blocked"}]
  },
  {
    build:"260908-DV13",label:"Pre-build 260908-DV13",shortLabel:"DV13",date:"8 September 2026",
    capabilityIndex:100,metric:"Development build",
    focus:["Flexible wording","Reviewed evaluation","Visible evidence"],
    notes:[
      "Expanded equivalent question forms and proof follow-ups while preserving scoped requests and evidence requirements.",
      "Added visible conversation history, working examples and readable evidence; feedback enters evaluation only after explicit review.",
      "Independent accuracy, confidence calibration and release-candidate readiness remain unverified."
    ],
    measurements:[{label:"Release status",value:"Development"},{label:"Public answerability",value:"Unmeasured"},{label:"RC gate",value:"Blocked"}]
  }

] as const;

export function releaseImprovement(index: number) {
  if (index <= 0 || index >= LEXI_RELEASES.length) return null;
  // No releases were measured on the same independent population.
  return null;
}
