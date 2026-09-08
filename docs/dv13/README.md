# Lexi DV13 development build

Build: **260908-DV13**. Status: **development, not RC**.

DV13 implements three focused improvements:

1. Equivalent wording for relational questions, compatible answer nouns, nested polite requests, possessives and bounded follow-ups. “Which city is the capital of France?” now shares the plan and evidence of “What is the capital of France?”. Repeated HTTP proof requests retain the original query and selected dictionary sense.
2. A reviewable evaluation workflow: frozen baseline and paraphrase cohorts, explicit real-use admission, cohort overlap checks, response-bound human adjudication and a failing RC gate when evidence is missing.
3. Human-readable proof descriptions attached to response traces, with source and proposition metadata preserved for inspection without changing the compact DV12 interface.

The interface preserves Lexi’s existing visual theme and stop behavior. Feedback remains local and opt-in. The active foundation remains `modules/dv12`; protocol and data compatibility do not require duplicating the engine under another version folder. Response traces and release metadata identify DV13.

## Verification

`npm run verify:dv13` runs types, integrity checks, release validation, the production build, client budget checks, all tests, evaluation and local performance measurements. `npm run build:github-pages` builds the optional static distribution. `npm run gate:dv13:rc` returns nonzero until the RC requirements are met.

`evaluation-results.json` separates development cohorts from independent results. `adjudication-queue.json` lists unresolved textual answers without approving them. `bundle-budget.json` and `performance.json` contain build and local Node measurements. These are not browser or production-network benchmarks.

## Limits retained

This is a bounded English grammar, not a general English parser. Unsupported joins, ambiguous ellipsis, time-scoped follow-ups and broad causal questions may require a complete question or abstain. Existing knowledge, retrieval limits and unclosed DV12 critical requirements remain; this release does not claim to repair all 243 audit items.

Independent cases and calibration profiles remain empty until real evidence is supplied and reviewed. The five unresolved baseline textual answers are not relabeled as correct by the implementation agent. Authored paraphrase tests do not establish improved real-world accuracy.

See [the review procedure](../../data/dv13/evaluation/README.md) and [current architecture](../ARCHITECTURE.md).
