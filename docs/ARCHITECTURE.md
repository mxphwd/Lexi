# Lexi prototype architecture

## Contract

Lexi is source-bound and deterministic. A response may select an authored
Extended Pack field, reuse an attributed dictionary definition, return a
response attached to a matched example, fill a declared sentence pattern, or
fall back. No module is permitted to invent a fact outside those inputs.

```text
User text
   │
   ▼
Discourse Module ─── up to four explicit clauses
   │
   ▼
Basic Phrases gate
   │
   ▼
Extended Pack ────── subject + requested semantic field
   │ if unmatched
   ▼
Full Dictionary lookup for definition forms
   │ if unmatched
   ▼
Sentence analysis
   │
   ▼
Search Module ────── ranked ContextEntry records + term evidence
   │
   ▼
Context Module ───── intent + confidence + supporting matches
   │
   ▼
Connect Module ───── subject/action/object/qualifier slots
   │
   ▼
Structure Module ─── clause realization + reviewed combination pattern
   │
   ├──► visible answer
   └──► inspectable clause-aware LexiTrace
```

## Module boundaries

### Discourse

`modules/discourse/` owns explicit sentence and coordinated-request boundaries.
Recognized request frames are inherited across coordinated items, so “What is
math and science?” becomes two complete definition requests. It processes at
most four clauses and can carry one explicit subject into a bounded pronoun or
implicit follow-up such as “why is it important?” Two explicit subjects support
`they`, `them`, and `both`; three or more subjects deliberately require
clarification instead of guessing a pair. It deduplicates identical answers and
combines their trace evidence. It does not add answer facts.

### Basic Phrases

`core/basic-phrases/` is checked independently for each clause. A match must
cover the complete normalized clause; unmatched clauses continue into the
Extended Pack.

### Extended Pack

`modules/extended-pack/` is the primary direct-answer layer for DV5. A
grammatical router recognizes definition, purpose, mechanism, importance,
example, component, relation, summary, learning, difference, and similarity
requests. It resolves the subject through canonical terms and aliases, then
selects one explicit field from an authored semantic record.

The pack currently holds 122 subjects and 434 recognized subject names. Its 164
question frames and 67 complete conversation patterns produce a conservative
lower bound of 71,243 direct constructions—3.99 times DV3's measured 17,861.
Its 347 linguistic features also include polite and indirect framing, answer
styles, and bounded singular or paired reference rules. Those rewrites are not
multiplied into the construction count.

`linguistic-features.ts` removes non-semantic discourse framing, recognizes
brief, simple, detailed, and example-supported requests, and records every
applied transformation. `query.ts` tests specific semantic forms before broad
definition forms so “What is mathematics used for?” cannot be captured as a
definition of “mathematics used for.”

### Search

`modules/search/` owns normalization, tokenization, unsupported-script checks,
sentence-mode detection, synonym expansion, and similarity scoring. It does not
choose the final intent.

The current scorer combines direct term overlap, expanded-term overlap, a
bigram Dice coefficient, and sentence-mode compatibility. Results are sorted by
score and then stable ID, so ties remain deterministic.

### Dictionary

`modules/dictionary/` recognizes bounded definition forms for subjects not
covered by the Extended Pack and reads the complete vendored Wordset dictionary.
Its compressed public archive is loaded only for a definition request, cached
after the first load, and looked up mechanically. A successful definition
records the Wordset entry ID and uses the literal `definition-full-wordset`
structure; a missing entry returns to the ordinary corpus path.

### Context

`modules/context/` owns intent selection. It combines ranked-example evidence
with explicit intent rules, then checks a confidence floor. Weak evidence becomes
`unknown`; it does not pass through as an answerable request.

The next scale step is a precomputed inverted index and calibrated per-intent
thresholds. Those changes should preserve the `ContextDecision` type.

### Connect

`modules/connect/` owns answer material. It either reuses slots and an answer
attached to the strongest compatible example or reads a bounded dictionary or
thesaurus record. It never writes the final sentence.

### Structure

`modules/structure/` owns realization. Each intent names a structure; each
structure declares a literal template. Adding hundreds of structures means
adding data and tests here rather than introducing a general-purpose generator.
The module also owns literal multi-answer structures for openings, ordered
parts, and closings.

## Traceability

Every response returns a `LexiTrace` containing:

- normalized input and detected sentence mode
- selected intent and confidence
- the three most relevant example IDs
- matched evidence terms
- selected sentence structure
- whether the response came from an exact example, a context pattern, the full
  Wordset dictionary, the Extended Pack, or the safe fallback
- for a combined response, the number and ordered intents of its clauses

The interface exposes this under “Why this response.”

## Release-history contract

`lib/lexi/releases.ts` is the single authored source for the interactive
release graph. It records a version label, date, relative capability index,
quantitative highlight, and reviewed notes for every plotted release.

The capability index is an internal development index—not an external
benchmark. It combines deterministic response reach, contextual precision,
lexical coverage, and model transparency on a stable 0–100 scale. Exact
measurements such as DV4's 3.99× direct-answer availability remain separate
highlighted metrics.

Every change to `LEXI_BUILD` must add one newest release record. Tests require
the latest record to match the current build and require the capability curve
to remain chronological and non-decreasing.

## Scaling without changing the model philosophy

1. Extend semantic topics with reviewed fields and aliases.
2. Evaluate every question frame against ambiguity and collision tests.
3. Partition fallback example pages by domain and version.
4. Build offline token, phrase, and intent indexes.
5. Promote only contexts whose thresholds reduce false matches.
6. Add structures as reviewed grammar data.
7. Keep thesaurus compilation offline; keep the compressed full dictionary and
   the fast conversational slice as distinct runtime paths.
8. Preserve source IDs through every compiled artifact.

Large corpus size alone does not create understanding. Labels, negative
examples, ambiguity boundaries, licensing, and evaluation quality are part of
the engine.
