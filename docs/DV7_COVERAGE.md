# DV7 coverage and availability

DV7 uses two measurements because construction scale and real question success
are different properties.

## Executable semantic construction surface

The availability function reads the live knowledge graph and predicate
registry. It includes only propositions whose predicates are marked
benchmarkable and only comparison pairs whose subjects share a recorded
predicate.

```text
open =
  benchmarkable propositions × open-question frames × answer styles

boolean =
  benchmarkable propositions × boolean-question frames × answer styles

comparison =
  same-predicate subject pairs × comparison frames × answer styles

semantic surface = open + boolean + comparison
```

Current checked-in inputs:

| Component | Count |
| --- | ---: |
| Entities | 590 |
| Aliases | 1,683 |
| Benchmarkable propositions | 3,132 |
| Predicate groups represented | 42 |
| Same-predicate subject pairs | 409,902 |
| Open frames | 12 |
| Boolean frames | 8 |
| Comparison frames | 60 |
| Answer styles | 10 |

The result is 246,567,600 semantic constructions. Against DV6’s frozen
500,347-construction baseline, the measured increase is 492.7932015×, displayed
as **492.79×**.

Styles are counted because each is an implemented realization route. Entity
aliases, politeness rewrites, discourse frames, inherited proofs, and
paraphrases are not additionally multiplied into the published total.

## Empirical end-to-end benchmark

`npm run benchmark:dv7` sends each question through the public Lexi engine. It
does not call the parser or graph in isolation.

The current 3,211 cases comprise:

- 110 hand-authored ordinary questions across conversation, definitions,
  properties, classification, abilities, causes and processes, geography,
  people, quantities, and bounded reasoning
- 17 ordered turns across six new session instances, checking personal memory
  and subject/reference continuity
- 3,084 generated reachability questions, one for every unique
  subject–predicate pair in the graph

The checked-in result is 3,211 passed, 0 failed. Each failure would be assigned
one of five actionable reasons:

- `parser-miss`
- `wrong-route`
- `content-miss`
- `proposition-miss`
- `memory-miss`

The generated reachability section prevents orphaned facts but is not an
independent sample of ordinary human phrasing. The curated section is small
relative to English. Therefore, the result is a regression guarantee for the
declared surface, not a universal availability percentage.

## Acceptance rule

For a graph or parser expansion to be accepted:

1. every new fact must remain reachable through at least one typed question
2. ambiguous or unsupported near-neighbor wording must not produce the fact
3. all existing benchmark categories must remain green
4. the full deterministic test suite must pass
5. new ordinary failures discovered during use should be added as curated cases
   before they are fixed
