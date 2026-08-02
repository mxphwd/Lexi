# DV9 data and measurement report

## Release inventory

| Resource | DV9 result | Target |
| --- | ---: | ---: |
| Validated atomic facts | 800,000 | 800,000 |
| Entities | 323,853 | 300,000–400,000 |
| Typed relation profiles | 3,200 | 3,000–4,000 |
| Explicit lexical senses | 163,274 | 150,000–200,000 |
| Query-plan examples | 100,000 | at least 100,000 |
| Inference-rule instances | 1,100 | 1,000–1,200 |
| Multi-turn dialogue scenarios | 40,000 | 40,000–50,000 |
| Isolated evaluation questions | 40,000 | 40,000–50,000 |
| Finished-answer constructions | 0 | only when required |

## Fact classes

The 800,000 total comprises 636,726 source-attested rows and 163,274
mechanically derived inverse/reference rows. DV9 adds no claim that these rows
were independently reviewed as general knowledge.

Wordset contributes entry, definition, grammatical-category, and usage-example
evidence. Moby contributes broad lexical associations. DV9 preserves upstream
source hashes and evidence locators in the generated manifest.

## Validation

`npm run dv9:validate-data` checks:

- artifact SHA-256 hashes
- entity and fact ID uniqueness
- subject and entity-object references
- recognized provenance codes and non-empty evidence
- confidence values between zero and one
- exact reconciliation of source-attested and derived fact totals
- development/evaluation prompt separation
- requested count ranges and the zero-answer-template boundary

## Evaluation

`npm run benchmark:dv9` maps every isolated question into a lexical plan and
runs a deterministic 1,000-case sample through real compressed shard loading,
sense selection, and answer realization.

Release result:

- isolated lexical plan mapping: 40,000/40,000
- proposition-aware dialogue plans: 40,000/40,000
- end-to-end lexical sample: 1,000/1,000
- parser latency: approximately 0.002 ms p50 and 0.004 ms p95 locally

These questions are source-derived and mechanically generated with frames held
outside the development example pack. They are not user-reported failure
questions and should not be described as proof of ordinary-language coverage.
