# Release graph calibration

## Result

The release-notes curve is an audited engineering-capability index, not an
answer-accuracy percentage. The current DV13 score is **79/100**. A score of
100 is reserved for a mature release with independently measured ordinary-
question coverage, calibrated confidence, broad compositional reasoning, and
production-ready execution. Lexi has not reached that evidence standard.

## Scoring model

Each release is scored against the same theoretical 100-point maturity rubric.
The dimensions are language mapping (25), executable knowledge (20),
compositional reasoning (20), dialogue state (10), evidence/calibration
discipline (15), and runtime integration (10). Counts of templates, aliases,
facts, or generated questions can support a dimension but cannot stand in for
answer accuracy. Generated regression suites establish bounded regressions
only. Development diagnostics are not treated as independent tests.

The public graph now consolidates the thirteen historical build labels into six
development versions: Initial build and DV2–DV6. Each large point uses the
maturity score of its final included build. Earlier builds appear as smaller
markers at their historical capability levels; the detailed reports remain
unchanged.

| Release | Score | Change | Language /25 | Knowledge /20 | Reasoning /20 | Dialogue /10 | Evidence /15 | Runtime /10 | Strongest available evidence |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Initial build (260720-1A–260721-0A) | 7 | baseline | 3 | 1 | 0 | 2 | 0 | 1 | implementation, example, and lexical inventory |
| DV2 (builds 260730-DV3–260730-DV6) | 27 | +20 | 10 | 6 | 5 | 4 | 1 | 1 | construction and feature inventory |
| DV3 (builds 260731-DV7–260801-DV8) | 52 | +25 | 15 | 11 | 13 | 6 | 4 | 3 | authored cases and generated regression checks |
| DV4 (build 260802-DV9) | 57 | +5 | 16 | 14 | 13 | 6 | 4 | 4 | source-derived pack validation |
| DV5 +1 (builds 260811-DV10–260812-DV11) | 68 | +11 | 17 | 17 | 14 | 7 | 6 | 7 | runtime/package validation and source-attested inventory |
| DV6 (builds 260904-DV12–260908-DV13) | 79 | +11 | 21 | 17 | 17 | 8 | 9 | 7 | authored development diagnostics |

## Consolidation audit

- Initial build combines 260720-1A and 260721-0A because both formed and
  populated the same four-module deterministic foundation.
- DV2 combines builds 260730-DV3–260730-DV6 because each expanded the same direct
  construction, corpus, and routing system. DV5 changed the release interface
  and added no engine-index capability.
- DV3 combines builds 260731-DV7–260801-DV8 because the first introduced the typed semantic
  architecture and DV8 completed its indexed parser and executor.
- DV4 keeps build 260802-DV9 separate because it introduced a distinct provenance,
  sense, sharding, and typed-data layer at a new scale.
- DV5 combines builds 260811-DV10–260812-DV11 +1 because they progressively
  connected plans, evidence, packages, Worker retrieval, and the AD1 knowledge
  layer through one runtime contract.
- DV6 combines builds 260904-DV12–260908-DV13 because the second deliberately reuses the first
  active engine and adds language, evidence, and evaluation refinements rather
  than a replacement architecture.

## Evidence audit

- DV7’s 246,567,600 “semantic constructions” and 492.79× headline were
  combinatorial surface counts. The suite contained 3,084 generated
  reachability questions, 110 authored ordinary questions, and 17 memory cases;
  it did not measure arbitrary-question answerability.
- DV8’s 4,124/4,124 result was a generated graph-derived regression surface.
  Its like-for-like improvement over the frozen DV7 path was 1.0467×, not
  1,000×, and it was not an independent public-use benchmark.
- DV9 validated 800,000 lexical claims, including 636,726 source-attested rows
  and 163,274 derived rows. Pack size increased knowledge potential, but much of
  that data was not yet connected to world-question execution.
- DV10 supplied the broadest external question source: 2,500 OpenTDB questions
  previously missed by DV9. It recorded 0 correct, 287 incorrect, 2,141
  unsupported abstentions, and 72 clarifications. Its substring-based evaluator
  prevents treating that result as a precise modern score, but the failure set
  is strong evidence that the earlier 100-point graph was overstated.
- DV11’s servicing patch connected package selection, shard loading, relinking,
  and server-side retrieval. AD1 added 719,949 source-attested world
  propositions, but the DV11 evaluation manifest contained no real failure rows
  and only 11 schema fixtures.
- DV12’s development diagnostic recorded 47 correct answers from 62 answerable
  cases (75.8%). DV13 recorded 71 from 86 (82.6%) after adding 29 authored
  paraphrase cases. The populations differ, both remain development-owned, and
  both contain zero independent evaluation rows, so they support maturity
  scoring rather than public accuracy claims.

## Sources inspected

The calibration uses `docs/DV7_COVERAGE.md`, `docs/DV8_BENCHMARK.md`,
`docs/DV9_DATA.md`, `docs/DV10_BENCHMARK.md`,
`docs/DV11_SERVICING_PATCH.md`, `docs/DV11AD1.md`, the DV11 evaluation
manifest, DV12 and DV13 evaluation results, their benchmark implementations,
the package manifests, and the historical release commits.

A future graph revision should use one frozen, leakage-checked, independently
reviewed population across releases. Until that exists, no point on this curve
should be described as ordinary-question accuracy or availability.
