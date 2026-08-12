import type { Dv11ClauseResult, Dv11ConfidenceComponents, Dv11ExecutionResult } from "./types";

export type Dv11CalibrationBucket = {
  lowerBound: number;
  upperBound: number;
  observedAccuracy: number;
  samples: number;
};

export type Dv11CalibrationProfile = {
  id: string;
  route?: string;
  intent?: string;
  relation?: string;
  difficulty?: string;
  buckets: Dv11CalibrationBucket[];
};

const profiles: Dv11CalibrationProfile[] = [];

export function registerDv11CalibrationProfile(profile: Dv11CalibrationProfile) {
  const existing = profiles.findIndex((candidate) => candidate.id === profile.id);
  if (existing >= 0) profiles[existing] = profile;
  else profiles.push(profile);
}

function rawConfidence(components: Dv11ConfidenceComponents) {
  const critical = [
    components.parsing,
    components.entityLinking,
    components.routing,
    components.evidence,
    components.proof,
    components.conflict,
    components.realization,
  ].map((value) => Math.max(0.001, Math.min(1, value)));
  const geometric = Math.exp(critical.reduce((sum, value) => sum + Math.log(value), 0) / critical.length);
  const weakest = Math.min(...critical);
  return Math.min(geometric, weakest + 0.18);
}

function matchingProfiles(clause: Dv11ClauseResult) {
  const group = clause.calibrationGroup;
  return profiles.filter((profile) =>
    (!profile.route || profile.route === group?.route)
    && (!profile.intent || profile.intent === group?.intent)
    && (!profile.relation || profile.relation === group?.relation)
    && (!profile.difficulty || profile.difficulty === group?.difficulty));
}

function applyProfile(score: number, profile: Dv11CalibrationProfile) {
  const bucket = profile.buckets.find((candidate) => score >= candidate.lowerBound && score < candidate.upperBound)
    ?? profile.buckets.find((candidate) => score === 1 && candidate.upperBound === 1);
  return bucket && bucket.samples >= 20 ? bucket.observedAccuracy : score;
}

export function calibrateDv11Clause(clause: Dv11ClauseResult): Dv11ClauseResult {
  let calibrated = rawConfidence(clause.confidence);
  for (const profile of matchingProfiles(clause)) calibrated = applyProfile(calibrated, profile);
  if (["unknown", "canceled", "error"].includes(clause.status)) calibrated = 0;
  if (clause.status === "ambiguous") calibrated = Math.min(calibrated, 0.35);
  if (clause.status === "insufficient" || clause.status === "partial") calibrated = Math.min(calibrated, 0.74);
  if (clause.propositions.some((proposition) => proposition.provenance.some((source) => source.reviewStatus === "disputed"))) calibrated = Math.min(calibrated, 0.4);
  if (!clause.proof.length && clause.propositions.length) calibrated = Math.min(calibrated, 0.45);
  return { ...clause, calibratedConfidence: Number(calibrated.toFixed(4)) };
}

export function calibrateDv11Result(result: Dv11ExecutionResult): Dv11ExecutionResult {
  const clauses = result.clauses.map(calibrateDv11Clause);
  const answered = clauses.filter((clause) => ["supported", "contradicted", "insufficient"].includes(clause.status));
  return {
    ...result,
    clauses,
    calibratedConfidence: answered.length ? Math.min(...answered.map((clause) => clause.calibratedConfidence)) : 0,
  };
}

export function dv11ReliabilityBuckets(rows: Array<{ confidence: number; correct: boolean }>) {
  return Array.from({ length: 10 }, (_, index) => {
    const lowerBound = index / 10;
    const upperBound = (index + 1) / 10;
    const samples = rows.filter((row) => row.confidence >= lowerBound && (index === 9 ? row.confidence <= upperBound : row.confidence < upperBound));
    return {
      lowerBound,
      upperBound,
      samples: samples.length,
      observedAccuracy: samples.length ? samples.filter((row) => row.correct).length / samples.length : 0,
      meanConfidence: samples.length ? samples.reduce((sum, row) => sum + row.confidence, 0) / samples.length : 0,
    };
  });
}
