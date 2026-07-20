# Alphaine Lexi Language

Lexi Language 1.0 Pre-build 260720-1A is a deterministic language-model
prototype. It does not call a generative model or predict tokens. Instead, the
same prompt and the same corpus always follow the same inspectable path:

`sentence analysis → Search → Context → Connect → Structure → response`

## Run the prototype

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open the local address printed in the terminal. Enter sends a message;
Shift+Enter adds a line. While Lexi is matching context, the send control becomes
a stop control. Shift-click the Alphaine wordmark to reveal the model build.

## Mechanical modules

- `modules/search/` normalizes English, inspects sentence mode, expands the
  compact lexicon, and ranks recorded examples.
- `modules/context/` aggregates example evidence and explicit phrase rules into
  one bounded intent with a confidence score.
- `modules/connect/` turns that intent into subject, action, object, and
  qualifier slots or a lexicon result.
- `modules/structure/` selects an English realization pattern and fills only
  the declared slots.
- `lib/lexi/engine.ts` passes records between the modules and returns the reply
  together with a public trace.

The prototype currently includes 12 context pages, 180 input-response examples,
and 360 paired sentences. This is a foundation for the intended much larger
corpus; it is not represented as a million-example system yet.

## Teach Lexi with new examples

Add English JSON pages to `data/example-contexts/`. The canonical format and
writing rules are in `data/example-contexts/README.md`, and a machine-readable
schema is in `data/example-contexts/schema.json`.

After adding a file:

1. Register its import in `data/example-contexts/catalog.ts`.
2. Run `npm run corpus:validate`.
3. Add examples that should match and near-neighbour examples that should not.
4. Run `npm test` before accepting the corpus change.

You can regenerate the included reference pages with
`npm run corpus:generate`. That command overwrites only the numbered starter
pages, so do not use it for hand-edited production pages.

## Dictionary and thesaurus

The complete requested sources are vendored under `data/lexicon/vendor/`:

- Wordset dictionary: compressed complete dictionary archive
- Moby Thesaurus: complete `words.txt` relation dataset

`npm run lexicon:build` deterministically extracts the small browser index in
`data/lexicon/runtime-index.json`. Expand `selectedTerms` in
`scripts/build-lexicon-index.mjs` as the context corpus grows. Source hashes,
repository URLs, and license notes are recorded in the generated index and in
`data/lexicon/ATTRIBUTION.md`.

## Verification

```bash
npm run corpus:validate
npm run lexicon:build
npm test
```

The tests cover deterministic intent selection, safe fallback behavior,
non-Latin writing-system detection, corpus integrity, and the rendered page.
See `docs/ARCHITECTURE.md` for the component contract and
`docs/LINGUISTIC_SOURCES.md` for the linguistic references used by the first
Structure Module.
