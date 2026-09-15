import type { Fact, Value } from './types';

export type TruthValue = 'true' | 'false' | 'unknown' | 'conflict';

export function combineTruth(values: readonly TruthValue[]): TruthValue {
  const known = new Set(values.filter((value) => value !== 'unknown'));
  if (known.has('conflict') || known.has('true') && known.has('false')) return 'conflict';
  if (known.has('true')) return 'true';
  if (known.has('false')) return 'false';
  return 'unknown';
}

export function propositionTruth(facts: readonly Fact[], expected: Value, requestedNegative: boolean, functional: boolean, equal: (left: Value, right: Value) => boolean): TruthValue {
  let supports = false, contradicts = false;
  for (const fact of facts) {
    if (equal(fact.object, expected)) {
      if (Boolean(fact.negative) === requestedNegative) supports = true;
      else contradicts = true;
    } else if (functional && !fact.negative && !requestedNegative) contradicts = true;
  }
  return supports && contradicts ? 'conflict' : supports ? 'true' : contradicts ? 'false' : 'unknown';
}
