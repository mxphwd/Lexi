# Lexi DV15 architecture

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

DV15 is the current development build. It reuses the execution foundation in `modules/dv12`, request and evidence helpers in `modules/dv13`, and the strict data-pack service in `modules/dv15`. The wire protocol remains version 12 for compatibility; it is not a release label. The response trace identifies DV15. Superseded DV7–DV11 responders remain recoverable through Git history.

## Wording and dialogue

`modules/dv13/language.ts` removes anchored request wrappers such as “Could you please tell me”. It never deletes arbitrary content, negative instructions, or conditions. `modules/dv12/parser.ts` binds relational question forms, compatible answer nouns, possessives, coordination and bounded elliptical follow-ups. Original clause text and spans remain available. Unknown subjects and incompatible answer nouns are not guessed.

A simple follow-up may replace one explicit subject. Multi-relation queries and temporal/scoped ellipsis require a full request. Proof requests reuse recorded proof; “Why?” means “What evidence supports your previous answer?”, not an invented causal explanation. The HTTP handler retains the underlying replay request and selected lexical sense across repeated proof turns. Complex requests retain their original scope rather than being flattened into generic property lookups.

## Evidence and resources

The server first consults the integrity-pinned DV15 catalog. Global entity-alias, entity-ID, and relation indexes rank compatible Basic or Advanced packs, with a strong preference for a pack containing both the mentioned subject and requested relation. The server validates and loads no more than six packs, 1,500 propositions, or 3 MiB of decoded data into a disposable request overlay, then relinks entities, reparses, and executes again. It falls through to the established DV12 composite source indexes only when needed.

All 750 packs retain claim-level provenance and are isolated from lexical senses. Unknown manifest fields, version mismatches, duplicate IDs, bad references, invalid value types, missing source information, and hash failures are rejected before store mutation. Discovery supplies symbols to reparsing but never authorizes an answer.

## Browser state and feedback

The browser displays only the current reply while keeping transactional session memory in the request client. It does not persist session memory across reloads, and canceled requests cannot commit a reply or new memory. The compact trace retains sources, proof identifiers, outcome and calibration availability without changing the DV12 interaction design.

Feedback is a redacted, editable local download only. Export consent is not consent to inclusion in an evaluation dataset. Admission requires documented human checks for sharing consent, privacy, complete context, expected answer and cohort selection.

## Evaluation boundary

Evaluation tooling in `modules/evaluation` and `scripts` is excluded from runtime imports. DV12/DV13 diagnostics, DV14 structural cases, and DV15 pack regressions are development evidence. Reviewed failures used during development cannot count as held-out results. DV15 has no independent or calibration cohort, so confidence and public-use accuracy remain unknown.

Unresolved text equivalence is exported for adjudication. Human decisions bind to a hash of the exact case, output, plan and values; changed answers need new review. RC readiness still requires independent coverage, held-out calibration and closure of inherited critical requirements. No generated test becomes independent human evidence.
