# DV10 semantic runtime

DV10 introduces one proposition contract across deterministic parsing,
source-reviewed evidence, lexical senses, bounded reasoning, dialogue state,
proof, and realization.

- `grammar.ts` produces typed semantic plans before legacy clause routing.
- `evidence.ts` contains compact source-reviewed propositions and typed values.
- `senses.ts` selects explicit Wordset senses with declared context neighborhoods.
- `dialogue.ts` records all reply propositions, sources, goals, and proof steps.
- `realizer.ts` renders plan results with agreement, lists, units, and provenance.
- `index.ts` exposes the unified capability route.

The frozen human-question benchmark under `data/dv10/benchmarks/` is never
imported here. Its expected answers may not be used by runtime code.
