# Lexi DV9 architecture

## Contract

Lexi is deterministic and source-bound. It may read a proposition, select an
explicit dictionary sense, execute a declared rule, perform a bounded
transformation, realize a proposition, use a reviewed example, or abstain. It
may not invent a missing edge or silently reinterpret a thesaurus association
as a verified fact.

```text
English input
  → clause segmentation and session memory
  → DV8 typed subject/relation/query planning
  → reviewed knowledge-graph execution when a typed subject is known
  → DV9 lexical query planning for the unresolved lexical long tail
  → one compiled shard, explicit senses, provenance, and confidence
  → proposition realization or calibrated abstention
```

## DV8 execution foundation

`modules/dv8/types.ts` defines lookups, boolean questions, selection,
aggregation, comparison, bounded transformations, and clarification. Its plans
contain triple patterns, variables, filters, quantifiers, temporal conditions,
negation, and answer style.

`modules/dv8/facts.ts` and `executor.ts` provide forward and inverse lookup,
joins, inheritance, transitivity, comparison, aggregation, condition checks,
three-valued truth, and proof steps. These remain the primary path for curated
general knowledge.

## DV9 data model

`modules/dv9/types.ts` distinguishes provenance, confidence, review status,
temporal validity, lexical operations, runtime meanings, and dialogue state.
The generator never stores a finished answer for each wording.

The data graph contains lemma nodes and sense nodes. Its principal atomic
relations are:

```text
lemma  —has_sense→        sense
sense  —sense_of→         lemma
sense  —has_definition→   text
sense  —part_of_speech→   typed literal
sense  —usage_example→    text
lemma  —lexically_associated→ lemma
```

The Moby relation is deliberately named `lexically_associated`; it is not a
strict synonym assertion.

## Provenance and uncertainty

Every generated fact contains a source code, source-local evidence locator,
confidence, and review class. The manifest identifies immutable source hashes,
repositories, and license notes. Source-attested, mechanically derived,
disputed, and independently reviewed material are different states.

“Validated atomic fact” means the row passed schema, reference, duplicate,
source, and confidence checks. It does not mean external human fact checking.
Temporal `validFrom`/`validTo`, conditions, and dispute references are present
in the DV9 schema for future curated facts.

## Compiled runtime shards

`scripts/build-dv9-data-pack.mjs` compiles 28 first-character shards. Each shard
contains stable lemma IDs, explicit sense IDs, part-of-speech literals,
definitions, examples, and bounded attributed associations. The browser loads
and caches only the shard required by the current term.

`modules/dv9/loader.ts` validates every decoded entry before exposing it.
Punctuation-bearing and Latin-extended headwords use lexical-safe
normalization, so abbreviations, slashes, apostrophes, and diacritics do not
collapse into unrelated terms.

## Language and dialogue

`modules/dv9/parser.ts` maps definition, sense-listing, grammatical-category,
usage-example, lexical-association, and source questions into explicit lexical
plans. Context hints select among recorded senses without deleting the other
senses.

`modules/dv9/dialogue.ts` stores the active lexical term, selected sense index,
prior-term stack, and a declared conversational goal. Follow-ups reuse that
state only inside the current session.

## Rules and relation profiles

The generated pack contains 3,200 predicate/domain/range profiles and 1,100
inspectable rule instances across inverse, symmetric, transitive, inheritance,
containment, comparison, negation, universal/existential quantification,
temporal validity, and causal-chain families. The generic DV8 executor supplies
the corresponding execution primitives; profiles constrain their typed use.

## Measurement boundary

The 100,000 query-plan examples are development data. The 40,000 evaluation
questions are stored separately, use different surface frames, and are never
imported by the runtime. They are still mechanically source-derived, not a
substitute for real user failures.

DV9 therefore reports language mapping, end-to-end lexical execution, data
integrity, and parser latency. It does not convert those results into a universal
availability multiplier. Future real failures must be frozen and scored before
their fixes are added.
