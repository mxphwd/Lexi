# Alphaine Lexi Language

Lexi Language 1.0 Pre-build 260812-DV11AD1 is a deterministic,
zero-generative-model language prototype. DV11AD1 adds a source-attested
ordinary-knowledge layer to the connected DV11 runtime. The Worker selects and
loads only compatible packages; the browser retains matched records and reports
the exact number of world propositions and lexical claims that are queryable.

Lexi does not call a generative model, predict tokens, use learned embeddings,
or convert an absent fact into a confident answer.

```text
input
  → DV11 normalization and typed query plan
  → global alias/entity/predicate/domain/sense index lookup in the Worker
  → matched package installation, reparse, relink, and execution
  → reviewed proposition, rule, or separate lexical claim
  → subject-compatible calibration
  → proposition realization and proof ledger
  → answer with evidence, or calibrated abstention
```

## DV11AD1 ordinary-knowledge extension

DV11AD1 contains 719,949 queryable world propositions across 506,655 entities
and 199 typed predicates. Global indexes cover 1,528,693 normalized aliases as
well as entity, predicate, subject, object, and domain lookups. Ten independently
loadable logical domains are implemented as 2,302 small physical shards, so a
question never requires the browser to retain the full knowledge graph.

The pack also compiles 29,640 relation-language mappings, 5,000 dialogue
scenarios, six executable dialogue behaviors, and thirteen reusable reasoning
bindings. Every proposition carries a source locator, extraction method, review
status, confidence, creation date, license, and dispute status. These records
are source-attested and structurally validated; they are not presented as
independently human-reviewed facts or as evidence of a universal accuracy rate.

See `docs/DV11AD1.md` for package boundaries, generation, validation, licensing,
and the exact live-count contract.

## DV11 live package connection

`modules/dv11/` owns one request, query-plan, executor, proof, realization,
dialogue, trace, package, and resource-client contract. On asynchronous browser
requests it parses first, asks `/api/lexi/resources` for compatible packages,
installs only returned records, reparses against the updated store, and executes
again. The Worker reads the large DV9 shards; normal browser lookups no longer
download an entire first-letter shard.

Lexemes, lexical senses, and lexical claims have separate stores from world
entities, semantic senses, and world propositions. This prevents a dictionary
sense node from becoming a world entity merely because the same spelling is
used in both systems.

The trace shown under “Why this response” reports live queryable counts from
the store. Those numbers are deliberately different from the catalog’s global
indexed-source counts. See `docs/DV11_SERVICING_PATCH.md`.

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

DV9 compiles the vendored Wordset dictionary and Moby thesaurus into compressed
source shards. In DV11, a lexical request resolves the relevant source record in
the Worker and transfers only a small typed package to the browser.
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

`modules/dv11/` is the active semantic runtime. `modules/dv9/` remains the
attributed lexical source layer and adds:

- lexical-safe Unicode and punctuation normalization
- explicit lexical query plans
- Worker-side on-demand shard loading and schema validation
- contextual sense selection and provenance-aware realization
- lexical proposition and conversational-goal state
- manifest validation and measured data statistics

Generated resources live under `data/dv9/`; runtime shards live under
`public/dv9/lexicon/`; global DV11 indexes and DV11AD1 package shards live under
`public/dv11/service/`.
The complete source archives remain under
`data/lexicon/vendor/` with their notices and hashes.

## Build and verify the data

```bash
npm run dv9:build-data
npm run dv9:validate-data
npm run dv11:build-service-data
npm run dv11:validate-service-data
npm run dv11ad1:fetch-source
npm run dv11ad1:build
npm run dv11ad1:validate
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
`docs/DV11_SERVICING_PATCH.md`, `docs/DV11AD1.md`,
`docs/DOCUMENTATION_MAPPING.md`, and `docs/RELEASES.md` for the complete
contracts.
