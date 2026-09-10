export type LexiRelease = {
  build: string;
  sourceBuilds: readonly {
    build: string;
    capabilityIndex: number;
  }[];
  label: string;
  shortLabel: string;
  foundation?: true;
  extensionLevel?: number;
  date: string;
  capabilityIndex: number;
  evidenceBasis: string;
  metric?: string;
  focus: readonly string[];
  measurements?: readonly {
    label: string;
    value: string;
  }[];
  notes: readonly string[];
};

/**
 * The capability index is an audited 0–100 engineering-maturity index, not an
 * answer-accuracy percentage. It weights language mapping (25), executable
 * knowledge (20), compositional reasoning (20), dialogue (10), evidence and
 * calibration discipline (15), and runtime integration (10). Evidence quality
 * limits each historical score; see docs/RELEASE_GRAPH_CALIBRATION.md.
 */
const HISTORICAL_BUILD_RECORDS = [
  {
    build: "260720-1A+260721-0A",
    label: "Initial build",
    shortLabel: "Initial build",
    foundation: true,
    date: "20–21 July 2026",
    capabilityIndex: 7,
    evidenceBasis: "Combined inventory audit · builds 260720-1A and 260721-0A",
    metric: "4,180 recorded examples",
    focus: ["Core pipeline", "Conversation", "Definitions"],
    notes: [
      "Combined Lexi’s first two foundation builds: the Search, Context, Connect, and Structure pipeline plus its initial deterministic trace.",
      "Foundational conversation, connected requests, and Wordset definitions grew that base to 4,180 recorded examples.",
    ],
  },
  {
    build: "260730-DV3",
    label: "Pre-build 260730-DV3",
    shortLabel: "DV3",
    date: "30 July 2026",
    capabilityIndex: 12,
    evidenceBasis: "Inventory audit · construction and subject counts",
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
    capabilityIndex: 18,
    evidenceBasis: "Inventory audit · implemented feature counts",
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
    capabilityIndex: 18,
    evidenceBasis: "Release-system change · no engine capability added",
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
    capabilityIndex: 27,
    evidenceBasis: "Inventory audit · construction and feature counts",
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
    capabilityIndex: 42,
    evidenceBasis: "Mixed authored/generated diagnostics · not independent",
    metric: "110 authored ordinary cases",
    focus: ["Typed meaning", "Knowledge graph", "Memory"],
    measurements: [
      { label: "Authored ordinary cases", value: "110" },
      { label: "Generated reachability", value: "3,084" },
      { label: "Seed propositions", value: "3,132" },
    ],
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
    capabilityIndex: 52,
    evidenceBasis: "Generated regression suite · not public-use coverage",
    metric: "4,124 generated checks",
    focus: ["Query plans", "Execution", "Calibration"],
    measurements: [
      { label: "Generated knowledge suite", value: "100.0%" },
      { label: "Generated language suite", value: "100.0%" },
      { label: "Generated reasoning suite", value: "100.0%" },
      { label: "Generated dialogue suite", value: "100.0%" },
      { label: "Generated precision suite", value: "100.0%" },
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
    capabilityIndex: 57,
    evidenceBasis: "Source-derived pack validation · runtime reach limited",
    metric: "800,000 lexical claims",
    focus: ["Atomic facts", "Word senses", "Typed data"],
    measurements: [
      { label: "Entities", value: "323,853" },
      { label: "Senses", value: "163,274" },
      { label: "Plan examples", value: "100,000" },
      { label: "Dialogue", value: "40,000" },
      { label: "Generated held-out plans", value: "40,000 / 40,000" },
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
    capabilityIndex: 60,
    evidenceBasis: "Human-authored quiz failure set · imperfect evaluator",
    metric: "2,500 OpenTDB failures",
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
    capabilityIndex: 68,
    evidenceBasis: "Runtime/inventory validation · no coverage benchmark",
    metric: "719,949 source-attested propositions",
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
    capabilityIndex:76,evidenceBasis:"62-case authored development diagnostic · not independent",metric:"47 / 62 authored answers",
    focus:["Server execution","Traceable reasoning","Honest measurement"],
    notes:[
      "Rebuilt the active execution path around typed plans, transactional dialogue, and server-side evidence retrieval.",
      "Added executable packages, arithmetic and temporal safeguards; independent answerability and RC readiness remain unverified."
    ],
    measurements:[{label:"Development diagnostic",value:"47 / 62"},{label:"Answerable success",value:"75.8%"},{label:"Independent evaluation rows",value:"0"},{label:"RC gate",value:"Blocked"}]
  },
  {
    build:"260908-DV13",label:"Pre-build 260908-DV13",shortLabel:"DV13",date:"8 September 2026",
    capabilityIndex:79,evidenceBasis:"91-case authored development diagnostic · not independent",metric:"71 / 86 authored answers",
    focus:["Flexible wording","Reviewed evaluation","Trace evidence"],
    notes:[
      "Expanded equivalent question forms and proof follow-ups while preserving scoped requests and evidence requirements.",
      "Added response-bound evidence steps and a reviewed feedback workflow while preserving the compact DV12 interaction design.",
      "Independent accuracy, confidence calibration and release-candidate readiness remain unverified."
    ],
    measurements:[{label:"Development diagnostic",value:"71 / 86"},{label:"Answerable success",value:"82.6%"},{label:"Independent evaluation rows",value:"0"},{label:"RC gate",value:"Blocked"}]
  }

] as const;

/**
 * The public graph records architectural milestones rather than every build
 * label. Exact historical build identifiers remain attached to each milestone
 * so the consolidation never erases the underlying development record.
 */
export const LEXI_RELEASES: readonly LexiRelease[] = [
  {
    ...HISTORICAL_BUILD_RECORDS[0],
    build: "260721-0A",
    sourceBuilds: [
      { build: "260720-1A", capabilityIndex: 3 },
      { build: "260721-0A", capabilityIndex: 7 },
    ],
  },
  {
    ...HISTORICAL_BUILD_RECORDS[4],
    label: "DV2",
    shortLabel: "DV2",
    sourceBuilds: HISTORICAL_BUILD_RECORDS.slice(1, 5).map((release) => ({
      build: release.build,
      capabilityIndex: release.capabilityIndex,
    })),
    date: "30 July 2026",
    evidenceBasis: "Combined inventory audit · DV3–DV6",
    focus: ["Extended pack", "Language forms", "Bounded reasoning"],
    notes: [
      "Builds 260730-DV3 through 260730-DV6 formed one direct-language generation: the Extended Pack, broader wording, follow-ups, and deterministic reasoning.",
      "Build 260730-DV5 changed the release interface but not engine capability; the final build reached 500,347 constructions and 800 added linguistic features.",
    ],
  },
  {
    ...HISTORICAL_BUILD_RECORDS[6],
    label: "DV3",
    shortLabel: "DV3",
    sourceBuilds: HISTORICAL_BUILD_RECORDS.slice(5, 7).map((release) => ({
      build: release.build,
      capabilityIndex: release.capabilityIndex,
    })),
    date: "31 July–1 August 2026",
    evidenceBasis: "Combined authored/generated diagnostics · DV7–DV8",
    focus: ["Typed meaning", "Query execution", "Session memory"],
    notes: [
      "Builds 260731-DV7 and 260801-DV8 formed Lexi’s semantic rebuild: typed meaning, a proposition graph, session memory, query plans, and compositional execution.",
      "The second build completed the architecture with indexed word senses and 4,124 generated regression checks, not a public-use accuracy benchmark.",
    ],
  },
  {
    ...HISTORICAL_BUILD_RECORDS[7],
    label: "DV4",
    shortLabel: "DV4",
    sourceBuilds: [{
      build: HISTORICAL_BUILD_RECORDS[7].build,
      capabilityIndex: HISTORICAL_BUILD_RECORDS[7].capabilityIndex,
    }],
    notes: [
      "Build 260802-DV9 introduced Lexi’s large typed-data generation with source-bearing lexical claims, explicit word senses, entities, and sharded retrieval.",
      "Its query examples, rules, and dialogue scenarios expanded the data layer without claiming independent world-question coverage.",
    ],
  },
  {
    ...HISTORICAL_BUILD_RECORDS[9],
    label: "DV5",
    shortLabel: "DV5",
    sourceBuilds: HISTORICAL_BUILD_RECORDS.slice(8, 10).map((release) => ({
      build: release.build,
      capabilityIndex: release.capabilityIndex,
    })),
    date: "11–12 August 2026",
    evidenceBasis: "Combined runtime, package, and inventory validation · DV10–DV11",
    focus: ["Unified contract", "Worker retrieval", "Loadable knowledge"],
    notes: [
      "Builds 260811-DV10 and 260812-DV11 formed one connected runtime, joining typed plans, evidence, dialogue, packages, and proof through one execution contract.",
      "Its +1 extension moved retrieval behind the Worker and supplied 719,949 source-attested propositions across ten domains.",
    ],
  },
  {
    ...HISTORICAL_BUILD_RECORDS[11],
    label: "DV6",
    shortLabel: "DV6",
    sourceBuilds: HISTORICAL_BUILD_RECORDS.slice(10, 12).map((release) => ({
      build: release.build,
      capabilityIndex: release.capabilityIndex,
    })),
    date: "4–10 September 2026",
    evidenceBasis: "Authored DV12–DV13 diagnostics + DV6 runtime reachability audit · not independent",
    focus: ["Server execution", "Flexible wording", "Reviewed evidence"],
    notes: [
      "Builds 260904-DV12 and 260908-DV13 share the same active typed server engine; the second refined wording, follow-ups, and inspectable evidence rather than replacing it.",
      "The latest development diagnostic reached 71 of 86 answerable authored cases, while independent accuracy and RC readiness remain unverified.",
      "A DV6 maintenance pass removed the unreachable historical responders, obsolete resource route, dormant corpora, and unreferenced public assets without changing the active model version.",
    ],
  },
] as const;

export function releaseIndexChange(index: number) {
  if (index <= 0 || index >= LEXI_RELEASES.length) return null;
  return LEXI_RELEASES[index].capabilityIndex - LEXI_RELEASES[index - 1].capabilityIndex;
}
