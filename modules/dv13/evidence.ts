import type { Result } from '../dv12/types';

/** Describe executed proof steps without turning rule names into new factual claims. */
export function evidenceSteps(results: Result[]) {
  const labels: Record<string, string> = {
    direct: 'Read a recorded fact', derived: 'Applied a declared reasoning rule',
    counterexample: 'Found a recorded counterexample',
    'explicit-or-functional-contradiction': 'Checked evidence that contradicts the requested claim',
    arithmetic: 'Calculated using arithmetic rules',
    'dimension-checked-conversion': 'Converted between compatible units',
    'explicit-session-memory': 'Used information you supplied in this session',
    'sense-definition': 'Looked up the selected dictionary meaning',
  };
  return [...new Map(results.flatMap(r => r.proof).map(p => [p.id, {
    id: p.id,
    description: labels[p.rule] ?? 'Applied the declared rule “' + p.rule.replaceAll('-', ' ') + '”',
    premises: p.premises,
    details: p.constraints.filter(Boolean),
  }])).values()];
}
