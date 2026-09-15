# Lexi DV14 architecture

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

DV14 is the current development build. It reuses and extends the execution foundation in `modules/dv12`, with request and evidence helpers in `modules/dv13`. The wire protocol remains version 12 for compatibility; it is not a release label. The response trace identifies DV14. Superseded DV7–DV11 responders remain recoverable through Git history.

## Wording and dialogue

`modules/dv13/language.ts` removes anchored request wrappers such as “Could you please tell me”. It never deletes arbitrary content, negative instructions, or conditions. `modules/dv12/parser.ts` binds relational question forms, compatible answer nouns, possessives, coordination and bounded elliptical follow-ups. Original clause text and spans remain available. Unknown subjects and incompatible answer nouns are not guessed.

A simple follow-up may replace one explicit subject. Multi-relation queries and temporal/scoped ellipsis require a full request. Proof requests reuse recorded proof; “Why?” means “What evidence supports your previous answer?”, not an invented causal explanation. The HTTP handler retains the underlying replay request and selected lexical sense across repeated proof turns. Complex requests retain their original scope rather than being flattened into generic property lookups.

## Evidence and resources

The server loads one integrity-pinned catalog and compatible shards through subject–predicate, predicate–object, entity-type, alias, subject, object, and predicate indexes. Discovery supplies symbols to reparsing but never authorizes an answer. Facts retain multiple source assertions. Immutable base data, disposable request overlays, open-world restrictions, adaptive hard budgets, cancellation, and package checks remain in force.

## Browser state and feedback

The browser displays only the current reply while keeping transactional session memory in the request client. It does not persist session memory across reloads, and canceled requests cannot commit a reply or new memory. The compact trace retains sources, proof identifiers, outcome and calibration availability without changing the DV12 interaction design.

Feedback is a redacted, editable local download only. Export consent is not consent to inclusion in an evaluation dataset. Admission requires documented human checks for sharing consent, privacy, complete context, expected answer and cohort selection.

## Evaluation boundary

Evaluation tooling in `modules/evaluation` and `scripts` is excluded from runtime imports. DV12/DV13 diagnostics and DV14 structural cases are development evidence. Reviewed failures used during development cannot count as held-out results. The DV14 independent and calibration cohorts are intentionally empty, so confidence and public-use accuracy remain unknown.

Unresolved text equivalence is exported for adjudication. Human decisions bind to a hash of the exact case, output, plan and values; changed answers need new review. RC readiness still requires independent coverage, held-out calibration and closure of inherited critical requirements. No generated test becomes independent human evidence.
