# Alphaine Lexi Language

Lexi Language 1.0 Pre-build 260730-DV4 is a deterministic language-model
prototype. It does not call a generative model or predict tokens. Instead, the
same prompt and the same embedded sources always follow the same inspectable
path:

`Discourse → Basic Phrases → Extended Pack → Dictionary → Search → Context → Connect → Structure → response`

The Basic Phrases gate returns only when a complete foundational phrase matches.
The Extended Pack then answers recognized subjects directly from authored
semantic fields and grammatical question frames. Only unknown pack subjects
continue to dictionary or corpus matching.
The Discourse Module separates explicit multi-part requests and inherits a
recognized opening frame across coordinated items. It sends each clause through
that same bounded path and recombines no more than four recorded answers with
reviewed Structure Module patterns.

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

- `core/basic-phrases/` contains the independent, fixed-response layer for
  greetings, identity, model age, thanks, farewells, and other foundational
  exchanges. It runs before every corpus module and retains no personal state.
- `modules/extended-pack/` is DV4's primary general-answer layer. Its 122
  authored subjects, 434 recognized names, 164 question frames, 58 linguistic
  rewrites, 58 bounded reference rules, and 67 complete conversational patterns
  provide 347 linguistic features and at least 71,243 direct constructions
  without searching example sentences or opening the dictionary.
- `modules/search/` normalizes English, inspects sentence mode, expands the
  compact lexicon, and ranks recorded examples.
- `modules/discourse/` separates explicit sentence and coordinated-request
  boundaries, including shared frames such as “What is math and science?”,
  deduplicates replies, and aggregates their trace evidence.
- `modules/dictionary/` recognizes definition requests and lazily reads the
  complete compressed Wordset archive. Its definitions retain their Wordset
  source IDs in the public response trace.
- `modules/context/` aggregates example evidence and explicit phrase rules into
  one bounded intent with a confidence score.
- `modules/connect/` turns that intent into subject, action, object, and
  qualifier slots or a lexicon result.
- `modules/structure/` selects an English realization pattern and fills only
  the declared slots. It also owns the reviewed opening, multipart, and closing
  structures used to combine answers.
- `lib/lexi/engine.ts` passes records between the modules and returns the reply
  together with a public trace.

The fallback corpus includes 62 context pages, 4,180 input-response examples,
and 8,360 paired sentences. It extends rather than defines DV4's direct
knowledge coverage.

## Extend DV4 knowledge

Add or revise typed records under `modules/extended-pack/topics/`. Every record
contains a definition, purpose, importance, example, related concepts, and
usually a mechanism and component list. The same record automatically supports
all compatible question frames and keeps one inspectable knowledge ID.

Add complete conversational behaviors to
`modules/extended-pack/conversation.ts`. These patterns must cover the complete
normalized message; do not use loose substring matches.

DV4's availability measure is intentionally conservative:
`434 subject names × 164 semantic question frames + 67 complete conversation
patterns = 71,243 direct constructions`. That is 3.99 times DV3's 17,861
construction baseline. Politeness, answer-style, and discourse rewrites are not
multiplied into that total.

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

The 2,000 generated basic-conversation examples can be rebuilt with
`npm run corpus:generate-basic`. This command overwrites pages 13 through 37.

The next 2,000 daily-life examples can be rebuilt with
`npm run corpus:generate-daily`. This command overwrites pages 38 through 62.
Run `npm run corpus:inventory` after changing corpus pages; the checked-in
`context-inventory.json` ledger records every page, intent, and example count.

## Dictionary and thesaurus

The complete requested sources are vendored under `data/lexicon/vendor/`:

- Wordset dictionary: compressed complete dictionary archive
- Moby Thesaurus: complete `words.txt` relation dataset

`npm run lexicon:build` deterministically extracts the fast conversational index
in `data/lexicon/runtime-index.json`. Definition questions for subjects outside
the Extended Pack additionally use the complete compressed archive published at
`public/lexicon/wordset-dictionary.json.gz`; it is fetched and decoded once on
first use, then cached for the session. Source hashes, repository URLs, license
notes, and the redistributed Wordset license are kept with the artifacts.

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
