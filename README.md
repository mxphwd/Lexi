# Alphaine Lexi Language

Lexi Language 1.0 Pre-build 260811-DV10 is a deterministic,
zero-generative-model language prototype. DV10 connects the typed language
planner, reviewed world propositions, graph traversal, explicit lexical senses,
deterministic rules, dialogue state, realization, and inspectable proofs through
one semantic precedence path.

Lexi does not call a generative model, predict tokens, use learned embeddings,
or convert an absent fact into a confident answer.

```text
input
  → DV10 normalization, typed plan, and conversational goal
  → reviewed proposition, graph edge, rule, or explicit lexical sense
  → subject-compatible calibration
  → proposition realization and proof ledger
  → answer with evidence, or calibrated abstention
```

## DV10 semantic connection

`modules/dv10/` supplies a single front path for compositional plans, reviewed
evidence, graph-derived member lists, bounded arithmetic, explicit Wordset
sense selection, follow-up correction, proof questions, and calibrated legacy
routing. Every successful DV10 answer carries proposition or rule IDs and proof
steps. A related word is not enough to authorize a factual answer.

DV10 also freezes 2,500 human-contributed questions that the untouched DV9
engine failed. The gzip artifact and its SHA-256 live under
`data/dv10/benchmarks/` and are never imported by runtime code. Run:

```bash
npm run benchmark:dv10
```

The release measurement is deliberately unflattering: the frozen factual pack
still records 0 correct answers, so DV10 does not claim the 88–92% ordinary
correctness target or any improvement multiplier. Separate deterministic probes
reach 100% for explicit sense selection, dialogue goals, and calibrated
abstention. See `docs/DV10_BENCHMARK.md` for the full boundary and caveats.

## Run Lexi

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Enter sends a message; Shift+Enter adds a line. Shift-click the Alphaine
wordmark to reveal the build and interactive release history.

## DV9 data layer

DV9 compiles the vendored Wordset dictionary and Moby thesaurus into small
first-character shards. A lexical request downloads only the relevant shard.
The runtime can now:

- select a dictionary sense from contextual words
- list multiple senses without merging them
- report recorded parts of speech and usage examples
- expose attributed Moby associations without calling them strict synonyms
- answer lexical follow-ups such as “another meaning,” “use it in an example,”
  and “where did that come from?”
- retain the active lexical term, selected sense, and conversational goal

Curated DV8 propositions remain ahead of generic dictionary definitions. This
preserves reviewed answers for known subjects while expanding the long tail.

## Data counts

The checked-in DV9 manifest reports:

- 800,000 schema-validated, provenance-bearing atomic facts
- 323,853 entities: 160,579 lemmas and 163,274 sense nodes
- 3,200 typed relation profiles across 32 base predicates
- 163,274 explicit lexical senses
- 100,000 compositional query-plan examples
- 1,100 rule instances across 11 inference families
- 40,000 multi-turn dialogue scenarios
- 40,000 isolated source-derived evaluation questions
- 0 new finished-answer constructions

“Validated” describes structure, referential integrity, deduplication, source
identity, and confidence bounds. It does not mean that a human independently
reviewed every dictionary or thesaurus assertion. DV9 keeps the following
classes separate:

- 636,726 source-attested rows
- 163,274 mechanically derived inverse/reference rows
- 0 newly independently reviewed general-knowledge rows

Moby edges are broad lexical associations, not guaranteed synonyms. The 40,000
evaluation questions use frames outside the query-plan example pack, but they
are source-derived rather than user-reported failures.

## Architecture

`modules/dv8/` remains the general typed parser, fact executor, and proposition
realizer. `modules/dv9/` adds:

- lexical-safe Unicode and punctuation normalization
- explicit lexical query plans
- on-demand shard loading and schema validation
- contextual sense selection and provenance-aware realization
- lexical proposition and conversational-goal state
- manifest validation and measured data statistics

Generated resources live under `data/dv9/`; runtime shards live under
`public/dv9/lexicon/`. The complete source archives remain under
`data/lexicon/vendor/` with their notices and hashes.

## Build and verify the data

```bash
npm run dv9:build-data
npm run dv9:validate-data
npm run benchmark:dv9
```

The validator checks artifact hashes, unique IDs, entity references, source
codes, confidence bounds, pack separation, target counts, and runtime shards.
The DV9 language check currently maps 40,000/40,000 isolated plan cases,
validates 40,000/40,000 dialogue-plan scenarios, and executes a 1,000/1,000
on-demand lexical sample. Parser latency measured during
the release run was approximately 0.004 ms p95 locally. This is a declared
lexical surface, not proof of universal question answering.

DV8’s six-metric benchmark remains frozen for regression comparison:

```bash
npm run benchmark:dv7
npm run benchmark:dv8
```

## Add future data juice

General knowledge should be added as one typed proposition per fact, with:

- stable subject and object IDs
- declared predicate domain and range
- source locator and license
- confidence and review status
- temporal validity and conditions when applicable
- dispute records rather than silent overwrites

Do not add many finished answers for paraphrases. Add a query-plan example when
the wording is missing, an inference rule when composition is missing, a
dialogue scenario when state is missing, or a reviewed proposition when
knowledge is missing. Real user failures must remain outside the development
pack until their blind score is recorded.

See `docs/ARCHITECTURE.md`, `docs/DV9_DATA.md`, `docs/DV10_BENCHMARK.md`,
`docs/DOCUMENTATION_MAPPING.md`, and `docs/RELEASES.md` for the complete
contracts.
