# Lexi DV13 architecture

Lexi is deterministic and source-bound. Supported English becomes a typed plan, which executes against explicit facts, dictionary senses or declared operations. Missing evidence produces clarification or abstention. A supported status means the engine found evidence under its rules; it does not certify the source as correct.

```text
Centered composer surface
  → BrowserSession sends input and bounded session state
  → POST /api/lexi/respond
  → request scaffolding, clause boundaries and typed grammar
  → evidence retrieval, package validation and argument binding
  → bounded rules, arithmetic, conversions or memory operations
  → answer realization, actual proof steps and source records
  → transactional browser acceptance and one centered reply
```

## Version boundary

DV13 is the product/runtime release. It reuses and extends the execution foundation in `modules/dv12`, with request and evidence helpers in `modules/dv13`. The wire protocol, session schema and knowledge-package runtime contract remain version 12 for compatibility; they are not release labels. The response trace identifies DV13. Superseded DV7–DV11 responders have been removed from the active tree and remain recoverable through Git history. The DV12 folder is shared active code, not a frozen DV12 binary.

## Wording and dialogue

`modules/dv13/language.ts` removes anchored request wrappers such as “Could you please tell me”. It never deletes arbitrary content, negative instructions, or conditions. `modules/dv12/parser.ts` binds relational question forms, compatible answer nouns, possessives, coordination and bounded elliptical follow-ups. Original clause text and spans remain available. Unknown subjects and incompatible answer nouns are not guessed.

A simple follow-up may replace one explicit subject. Multi-relation queries and temporal/scoped ellipsis require a full request. Proof requests reuse recorded proof; “Why?” means “What evidence supports your previous answer?”, not an invented causal explanation. The HTTP handler retains the underlying replay request and selected lexical sense across repeated proof turns. Complex requests retain their original scope rather than being flattened into generic property lookups.

## Evidence and resources

The server loads one integrity-pinned DV12 catalog and only the compatible shards required by the request. The retired standalone resource endpoint and unreferenced legacy indexes are not shipped. Facts distinguish source records, review status and provenance. The DV12 execution budgets, immutable base store, disposable request overlays, open-world restrictions and package checks remain in force. DV13 adds human-readable descriptions of executed proof steps; it does not add new evidence by describing them.

## Browser state and feedback

The browser displays only the current reply while keeping transactional session memory in the request client. It does not persist session memory across reloads, and canceled requests cannot commit a reply or new memory. The compact trace retains sources, proof identifiers, outcome and calibration availability without changing the DV12 interaction design.

Feedback is a redacted, editable local download only. Export consent is not consent to inclusion in an evaluation dataset. Admission requires documented human checks for sharing consent, privacy, complete context, expected answer and cohort selection.

## Evaluation boundary

Evaluation tooling in `modules/evaluation` and `scripts` is excluded from runtime imports. Frozen DV12 diagnostics and DV13 authored paraphrases are development evidence. Reviewed failures used during development cannot count as held-out results. Exact normalized prompt/context overlaps are rejected across cohorts; human review must additionally check semantic duplicates and prior exposure.

Unresolved text equivalence is exported for adjudication. Human decisions bind to a hash of the exact case, output, plan and values; changed answers need new review. RC readiness still requires independent coverage, held-out calibration and closure of inherited critical requirements. No generated test becomes independent human evidence.
