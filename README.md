# Alphaine Lexi Language

Lexi Language 1.0 Pre-build 260801-DV8 is a deterministic,
zero-generative-model language prototype. DV8 replaces the remaining
question-to-relation shortcut with a typed query language, compiled word-sense
index, normalized fact store, compositional executor, proposition-aware
dialogue state, and calibrated abstention.

The same input, embedded sources, and session state always follow the same
inspectable path:

`Discourse → session/proposition state → deterministic gates → compiled lexical
index → typed query plan → normalized fact indexes → query executor → answer
realizer → calibrated abstention or bounded legacy fallback`

Lexi does not call a generative model, predict tokens, use learned embeddings,
or silently invent a missing fact. DV8 factual responses carry the normalized
fact IDs and execution rules used to construct them.

## Run the prototype

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open the printed local address. Enter sends a message; Shift+Enter adds a line.
The send control becomes a stop control while Lexi resolves a response.
Shift-click the Alphaine wordmark to reveal the build and release history.

## DV8 modules

- `modules/dv8/parser.ts` builds a `QueryPlan` with operations, variables,
  triple patterns, filters, conditions, quantifiers, time, negation, and style.
- `modules/dv8/lexicon.ts` compiles graph names into a token trie and preserves
  explicit senses for ambiguous spellings.
- `modules/dv8/facts.ts` expands lists into atomic facts, converts safe values
  to entity edges or typed literals, normalizes units, and builds forward and
  inverse indexes.
- `modules/dv8/executor.ts` runs joins, inheritance, filters, aggregates,
  comparisons, negatives, quantifiers, conditions, and temporal checks.
- `modules/dv8/dialogue.ts` records answer propositions, subjects, proof, and
  conversational goals for bounded follow-ups.
- `modules/dv8/tasks.ts` provides bounded conversion, sorting, grammar repair,
  reviewed phrase translation, extractive summarization, and rewriting.
- `modules/dv8/realizer.ts` constructs reviewed English from execution results.

The existing `modules/knowledge-graph/` remains the reviewed factual source.
`core/basic-phrases/`, `modules/extended-pack/`, the full Wordset dictionary,
and the original Search → Context → Connect → Structure path remain bounded
compatibility layers.

The fallback corpus contains 62 pages, 4,180 input-response examples, and 8,360
paired sentences. It is no longer the primary factual architecture.

## Measured DV8 coverage

DV8 replaces the old single availability headline with six measurements. The
checked-in blind suite contains 4,124 stateless cases plus 120 dialogue
sessions. The validated result is:

- knowledge: 588/588 (100.0%)
- language robustness: 3,202/3,202 (100.0%)
- reasoning: 171/171 (100.0%)
- dialogue: 120/120 (100.0%)
- precision and calibrated abstention: 163/163 (100.0%)
- local latency: 0.23 ms p50 and 0.30 ms p95 over 300 samples

The frozen DV7 path passes 3,940/4,124 on the same stateless suite. The measured
like-for-like total success gain is therefore **1.0467×**. DV8 does not claim a
1,000× improvement because the checked-in evidence does not support it. The
suite is a regression instrument over a declared surface, not proof of
universal English understanding.

```bash
npm run benchmark:dv7
npm run benchmark:dv8
```

See `docs/DV8_BENCHMARK.md` for the method. The historical DV7 construction
surface remains documented in `docs/DV7_COVERAGE.md` and is not used as DV8's
headline.

## Extend DV8

Add reviewed entities and typed facts under `modules/knowledge-graph/data/`.
Prefer one proposition per fact and qualifiers for scope, condition, time,
unit, or uncertainty. An alias must identify the same entity, not a merely
related subject.

For a new relation or language form:

1. declare its predicate semantics and inverse/inheritance behavior
2. map wording to a typed DV8 plan rather than a finished answer
3. add the executor rule and reviewed realization
4. add positive, paraphrased, negative, ambiguity, and abstention cases
5. run both benchmarks and the full test suite

Add example pages only when a graph proposition is the wrong representation.
Their format is documented in `data/example-contexts/README.md` and
`data/example-contexts/schema.json`.

## Dictionary and thesaurus

The requested complete sources are vendored under `data/lexicon/vendor/`:

- Wordset dictionary: compressed complete dictionary archive
- Moby Thesaurus: complete `words.txt` relation dataset

`npm run lexicon:build` creates the fast conversational runtime index. The full
Wordset archive is published at `public/lexicon/wordset-dictionary.json.gz` and
loaded on demand. Source hashes, repository URLs, license notes, and the
Wordset license remain beside the artifacts.

## Release and verification

Every build change must add one newest entry to `lib/lexi/releases.ts`. DV8's
interactive tooltip displays knowledge, language, reasoning, dialogue,
precision, and latency separately.

```bash
npm run lint
npm run corpus:validate
npm run benchmark:dv7
npm run benchmark:dv8
npm test
```

See `docs/ARCHITECTURE.md`, `docs/DOCUMENTATION_MAPPING.md`,
`docs/LINGUISTIC_SOURCES.md`, and `docs/RELEASES.md` for detailed contracts.
