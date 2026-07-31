# Alphaine Lexi Language

Lexi Language 1.0 Pre-build 260731-DV7 is a deterministic, zero-generative-model
language prototype. DV7 replaces finished-answer matching as the main knowledge
path with typed questions, atomic propositions, explicit reasoning rules,
proposition realization, and session memory.

The same prompt, embedded sources, and session state always follow the same
inspectable path:

`Discourse → Session memory → Basic phrases → Numeric reasoning → Semantic parser
→ Knowledge graph → Reasoner → Proposition realizer → legacy fallbacks`

Lexi does not call a generative model, predict tokens, use learned embeddings, or
silently invent a missing fact. Every knowledge-graph response carries the
proposition IDs and proof rules used to construct it.

## Run the prototype

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open the local address printed in the terminal. Enter sends a message;
Shift+Enter adds a line. While Lexi is resolving a response, the send control
becomes a stop control. Shift-click the Alphaine wordmark to reveal the model
build and interactive release history.

## The DV7 architecture

- `modules/semantic/` turns varied question forms into a typed
  `SemanticQuery`: question kind, subject, object, relation, requested property,
  condition, quantity, time, style, and negation.
- `modules/knowledge-graph/` contains reviewed entities and atomic propositions
  covering foundational science, nature, everyday objects, places, geography,
  people, processes, units, formulas, and technical concepts.
- `modules/knowledge-graph/reasoner.ts` answers direct facts, follows explicit
  classification and inheritance links, derives inverse locations, compares
  two subjects on one shared relation, and returns an inspectable proof.
- `modules/proposition/` realizes propositions into reviewed English structures.
  It does not store one complete answer for every possible wording.
- `modules/memory/` keeps a name, age, location, preferences, active subjects,
  previous question, and previous answer inside one `LexiSession`. It does not
  persist those values across sessions.
- `modules/benchmark/` runs hand-authored ordinary questions, conversational
  memory scenarios, and one end-to-end reachability test for every unique
  subject–predicate pair. Failures are classified as parser, routing, content,
  proposition, or memory misses.
- `core/basic-phrases/` remains the independent foundation for greetings,
  identity, model age, thanks, farewells, and other exact basic exchanges.
- `modules/extended-pack/` remains the DV6 compatibility and fallback layer for
  authored topics, deterministic calculations, conversational patterns,
  summaries, and learning paths.
- `modules/dictionary/` lazily reads the complete compressed Wordset dictionary
  for definition requests not answered by the graph.
- `modules/search/`, `modules/context/`, `modules/connect/`, and
  `modules/structure/` preserve the original example-context fallback.
- `modules/discourse/` separates explicit multi-part requests, preserves known
  compound entity names, carries bounded follow-up subjects, and recombines up
  to four answers.

The fallback corpus contains 62 context pages, 4,180 input-response examples,
and 8,360 paired sentences. It is useful training-style material and a final
fallback, but it is no longer the primary knowledge architecture.

## Measured DV7 coverage

The checked-in graph currently contains:

- 590 entities and 1,683 recognized aliases
- 3,132 benchmarkable propositions across 42 relations
- 409,902 same-relation subject pairs available to comparison rules
- 12 open-question, 8 boolean-question, and 60 comparison forms
- 10 answer styles

Those actual records produce a conservative executable surface of
246,567,600 semantic constructions, or **492.79× DV6’s 500,347-construction
baseline**. The calculation counts only existing propositions and pairs of
subjects that share a recorded relation.

That scale measure is separate from the empirical coverage benchmark. The
checked-in DV7 suite currently passes **3,211 of 3,211** cases: 110 curated
ordinary questions, 17 stateful memory/reference turns, and 3,084 generated
subject–predicate reachability checks. It proves the tested surface remains
executable; it is not a claim that Lexi knows every fact or understands arbitrary
language.

Run the report with:

```bash
npm run benchmark:dv7
```

The exact methodology is in `docs/DV7_COVERAGE.md`.

## Extend DV7 knowledge

Add entities and typed facts to a data pack under
`modules/knowledge-graph/data/`. Prefer one proposition per fact and use
qualifiers for scope, condition, time, unit, or uncertainty. Add aliases only
when they identify the same entity rather than a merely related subject.

For each new relation or question form:

1. declare the predicate and its inheritance or inverse behavior
2. update the typed semantic parser
3. add a reviewed realization structure
4. add positive, paraphrased, and collision/unsupported tests
5. run `npm run benchmark:dv7` and `npm test`

Add English example pages to `data/example-contexts/` only when the graph is not
the right representation. The canonical format is documented in
`data/example-contexts/README.md`, with a machine-readable schema in
`data/example-contexts/schema.json`.

## Dictionary and thesaurus

The complete requested sources are vendored under `data/lexicon/vendor/`:

- Wordset dictionary: compressed complete dictionary archive
- Moby Thesaurus: complete `words.txt` relation dataset

`npm run lexicon:build` deterministically extracts the fast conversational
index in `data/lexicon/runtime-index.json`. The full Wordset archive is published
at `public/lexicon/wordset-dictionary.json.gz`, loaded on demand, and cached for
the current runtime. Source hashes, repository URLs, license notes, and the
redistributed Wordset license remain beside the artifacts.

## Release and verification

Every build change must add exactly one newest record to
`lib/lexi/releases.ts`. The interactive release graph and footer are protected
by tests so they cannot silently drift apart.

```bash
npm run lint
npm run corpus:validate
npm run benchmark:dv7
npm test
```

See `docs/ARCHITECTURE.md` for the component contracts,
`docs/DOCUMENTATION_MAPPING.md` for the relationship to the original Lexi
documentation, `docs/LINGUISTIC_SOURCES.md` for reviewed linguistic references,
and `docs/RELEASES.md` for the permanent release rule.
