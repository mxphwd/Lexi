import { dv8FactStore } from "@/modules/dv8";
import { dv10Normalize } from "./normalize";
import type { Dv10Proposition, Dv10QueryPlan } from "./types";

const nasaMercury = "https://science.nasa.gov/mercury/facts/";
const nasaMoon = "https://science.nasa.gov/learn/basics-of-space-flight/chapter1-2/";
const nasaSaturn = "https://science.nasa.gov/saturn/facts/";
const nistCpu = "https://csrc.nist.gov/glossary/term/central_processing_unit";
const nihSleep = "https://www.nichd.nih.gov/health/topics/sleep/conditioninfo/Pages/default.aspx";
const internetHistory = "https://www.internetsociety.org/internet/history-internet/brief-history-internet-related-networks/";
const germanyNeighbors = "https://www.make-it-in-germany.com/en/living-in-germany/discover-germany/german-states";

export const dv10Evidence: readonly Dv10Proposition[] = [
  {
    id: "dv10-fact:continent-count",
    subject: "continents",
    subjectAliases: ["continent regions", "earth continents"],
    predicate: "count",
    object: { kind: "number", value: 7 },
    qualifiers: { scope: "the commonly taught seven-continent convention" },
    provenance: {
      sourceId: "curated:continent-convention",
      title: "Seven-continent geographic convention",
      url: "https://education.nationalgeographic.org/resource/Continent/",
      evidenceLocator: "continent convention",
      reviewStatus: "source-reviewed",
      confidence: 0.98,
    },
  },
  {
    id: "dv10-fact:mercury-closest-sun",
    subject: "planet",
    subjectAliases: ["planets"],
    predicate: "closest_to",
    object: { kind: "entity", value: "Mercury" },
    qualifiers: { scope: "closest planet", condition: "target is the Sun" },
    provenance: {
      sourceId: "nasa:mercury-facts",
      title: "Mercury Facts",
      url: nasaMercury,
      evidenceLocator: "Introduction and Size and Distance",
      reviewStatus: "source-reviewed",
      confidence: 1,
    },
  },
  {
    id: "dv10-fact:moon-earth-distance",
    subject: "moon",
    subjectAliases: ["earth's moon", "the moon"],
    predicate: "average_distance",
    object: { kind: "number", value: 384_400, unit: "kilometers" },
    qualifiers: { scope: "average orbital distance", condition: "measured from Earth" },
    provenance: {
      sourceId: "nasa:spaceflight-basics",
      title: "Basics of Space Flight: The Solar System",
      url: nasaMoon,
      evidenceLocator: "Earth-Moon system",
      reviewStatus: "source-reviewed",
      confidence: 1,
    },
  },
  {
    id: "dv10-fact:water-freezing",
    subject: "water",
    subjectAliases: ["liquid water"],
    predicate: "state_transition",
    object: { kind: "text", value: "liquid water changes into solid ice as its molecules settle into a crystalline structure" },
    qualifiers: { condition: "temperature falls to the freezing point at the relevant pressure" },
    provenance: {
      sourceId: "curated:water-phase-change",
      title: "Water phase transition",
      url: "https://www.usgs.gov/special-topics/water-science-school/science/ice-snow-and-glaciers-and-water-cycle",
      evidenceLocator: "freezing and ice formation",
      reviewStatus: "source-reviewed",
      confidence: 0.99,
    },
  },
  {
    id: "dv10-fact:cpu-definition",
    subject: "central processing unit",
    subjectAliases: ["cpu", "processor"],
    predicate: "definition",
    object: { kind: "text", value: "the computer component that interprets and executes program instructions and coordinates core processing operations" },
    provenance: {
      sourceId: "nist:cpu",
      title: "Central Processing Unit — NIST Glossary",
      url: nistCpu,
      evidenceLocator: "CPU glossary entry",
      reviewStatus: "source-reviewed",
      confidence: 0.99,
    },
  },
  {
    id: "dv10-fact:sleep-purpose",
    subject: "human sleep",
    subjectAliases: ["sleep", "humans sleep", "people sleep"],
    predicate: "purpose",
    object: { kind: "text", value: "sleep helps the brain process information and form memories while supporting energy restoration, metabolism, immune function, and broader health" },
    provenance: {
      sourceId: "nih:sleep",
      title: "About Sleep",
      url: nihSleep,
      evidenceLocator: "Why sleep is important",
      reviewStatus: "source-reviewed",
      confidence: 0.98,
    },
  },
  {
    id: "dv10-fact:germany-borders",
    subject: "Germany",
    subjectAliases: ["federal republic of germany"],
    predicate: "borders",
    object: {
      kind: "list",
      values: ["Denmark", "Poland", "the Czech Republic", "Austria", "Switzerland", "France", "Luxembourg", "Belgium", "the Netherlands"],
    },
    provenance: {
      sourceId: "germany:neighbors",
      title: "Germany and its neighboring countries",
      url: germanyNeighbors,
      evidenceLocator: "nine neighbouring European countries",
      reviewStatus: "source-reviewed",
      confidence: 1,
    },
  },
  {
    id: "dv10-fact:internet-origin",
    subject: "Internet",
    subjectAliases: ["the internet"],
    predicate: "origin",
    object: { kind: "text", value: "the Internet was not invented in one moment: ARPANET began the packet-network lineage, DARPA started its Internetting program in 1973, and the transition to TCP/IP in 1983 established the interoperable network foundation" },
    qualifiers: { time: "1960s–1983" },
    provenance: {
      sourceId: "internet-society:history",
      title: "A Brief History of the Internet and Related Networks",
      url: internetHistory,
      evidenceLocator: "Internetting concepts and TCP/IP transition",
      reviewStatus: "source-reviewed",
      confidence: 0.98,
    },
  },
  {
    id: "dv10-fact:saturn-density",
    subject: "Saturn",
    subjectAliases: ["planet saturn"],
    predicate: "interesting_fact",
    object: { kind: "text", value: "Saturn is the only planet in the Solar System whose average density is lower than water" },
    provenance: {
      sourceId: "nasa:saturn-facts",
      title: "Saturn Facts",
      url: nasaSaturn,
      evidenceLocator: "Structure",
      reviewStatus: "source-reviewed",
      confidence: 1,
    },
  },
];

function compatibleSubject(plan: Dv10QueryPlan, proposition: Dv10Proposition) {
  const requested = plan.subject?.normalized;
  if (!requested) return false;
  return [proposition.subject, ...proposition.subjectAliases]
    .map(dv10Normalize)
    .some((candidate) => candidate === requested || candidate.replace(/s$/, "") === requested.replace(/s$/, ""));
}

export function findDv10Evidence(plan: Dv10QueryPlan) {
  return dv10Evidence.filter((proposition) =>
    proposition.predicate === plan.relation && compatibleSubject(plan, proposition),
  );
}

export function listDv10Members(plan: Dv10QueryPlan) {
  if (plan.relation !== "member" || !plan.subject) return [];
  const requested = plan.subject.normalized.replace(/s$/, "");
  const classId = requested === "mammal" ? "class-mammal" : requested === "animal" ? "class-animal" : undefined;
  if (requested === "planet") {
    return ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"].slice(0, plan.quantity ?? 3);
  }
  if (!classId) return [];
  return dv8FactStore.graph.allEntities()
    .filter((entity) => entity.id !== classId && dv8FactStore.isA(entity.id, classId).value)
    .filter((entity) => !entity.name.startsWith("class-"))
    .map((entity) => entity.name)
    .slice(0, plan.quantity ?? 3);
}
