# DV8 blind benchmark

DV8 measures six dimensions rather than multiplying stored templates into one
headline availability number.

| Measurement | Cases | DV8 result | Meaning |
| --- | ---: | ---: | --- |
| Knowledge | 588 | 100.0% | Canonical questions over recorded entities |
| Language robustness | 3,202 | 100.0% | Independent paraphrases and property forms |
| Reasoning | 171 | 100.0% | Classification, inverse lookup, joins, conditions, negation, quantifiers, comparison, aggregates, and bounded tasks |
| Dialogue | 120 sessions | 100.0% | Proposition-aware active-subject follow-ups |
| Precision | 163 | 100.0% | Correct refusal of unsupported or temporally unqualified claims |
| Latency | 300 samples | 0.23 ms p50 / 0.30 ms p95 | Local synchronous validation time |

The stateless total is 4,124/4,124. The same evaluator gives the frozen DV7
path 3,940/4,124, so the total success ratio is 1.0467×. This is reported
instead of the requested 1,000× because benchmarks must not be manufactured.

The suite is blind at the surface-form level: its templates are separate from
the parser registry, and hand-written DV7 failures live in
`data/benchmarks/dv8-blind.ts`. Some cases are generated from the live graph so
every represented subject remains exercised. Therefore 100% is a regression
guarantee over this declared surface, not an estimate of arbitrary real-world
question coverage.

```bash
npm run benchmark:dv8
```

Add every real failure to the curated blind file before its fix.
