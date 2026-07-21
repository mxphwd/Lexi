# Lexi prototype architecture

## Contract

Lexi is corpus-bound and deterministic. A response may reuse an attributed
dictionary definition, return a response attached to a matched example, fill a
declared sentence pattern, or fall back. No module is permitted to invent a
fact outside those inputs.

```text
User text
   │
   ▼
Discourse Module ─── up to four explicit clauses
   │
   ▼
Basic Phrases gate or sentence analysis
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
It processes at most four clauses, deduplicates identical answers, and combines
their trace evidence. It does not infer an unstated clause or add answer facts.

### Basic Phrases

`core/basic-phrases/` is checked independently for each clause. A match must
cover the complete normalized clause; unmatched clauses continue into Search.

### Search

`modules/search/` owns normalization, tokenization, unsupported-script checks,
sentence-mode detection, synonym expansion, and similarity scoring. It does not
choose the final intent.

The current scorer combines direct term overlap, expanded-term overlap, a
bigram Dice coefficient, and sentence-mode compatibility. Results are sorted by
score and then stable ID, so ties remain deterministic.

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
- whether the response came from an exact example, a context pattern, or the
  safe fallback
- for a combined response, the number and ordered intents of its clauses

The interface exposes this under “Why this response.”

## Scaling without changing the model philosophy

1. Partition example pages by domain and version.
2. Build offline token, phrase, and intent indexes.
3. Evaluate every context release against a frozen ambiguity suite.
4. Promote only contexts whose thresholds reduce false matches.
5. Add structures as reviewed grammar data.
6. Keep dictionary and thesaurus compilers offline; ship compact runtime slices.
7. Preserve source IDs through every compiled artifact.

Large corpus size alone does not create understanding. Labels, negative
examples, ambiguity boundaries, licensing, and evaluation quality are part of
the engine.
