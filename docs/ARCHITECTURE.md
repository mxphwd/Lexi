# Lexi DV7 architecture

## Contract

Lexi is deterministic and source-bound. It may retrieve a proposition, join
propositions through a declared rule, realize the result with a reviewed
structure, reuse an attributed dictionary definition, return a matched example,
or refuse the request. No module may invent a factual edge outside those
sources.

```text
User text
   │
   ▼
Discourse ───────────── bounded clauses and carried subjects
   │
   ▼
Session memory ──────── personal facts and conversation state
   │
   ├──► Basic phrases / deterministic calculations
   │
   ▼
Typed semantic parser
   │    question kind · subjects · relation · object/property
   │    condition · quantity · time · style · negation
   ▼
Curated knowledge graph
   │
   ▼
Compositional reasoner
   │    direct · inverse · inheritance · classification
   │    transitive · comparison · derived location
   ▼
Proposition realizer
   │
   ├──► visible answer
   └──► proposition IDs + explicit proof trace
   │
   ▼ if no supported graph answer
DV6 Extended Pack → Wordset → Search → Context → Connect → Structure
```

## Module boundaries

### Discourse

`modules/discourse/` owns explicit sentence and coordinated-request boundaries.
It separates at most four clauses, preserves known compound entities, and
inherits one recognized frame or subject into a bounded follow-up. Two explicit
subjects can support a paired reference; three possible antecedents require
clarification. Combination deduplicates answers and aggregates evidence but
adds no facts.

### Session memory

`modules/memory/` stores only values explicitly supplied or resolved in the
current `LexiSession`: name, age, location, up to 20 preferences, active subject
IDs, previous question, and previous answer. Stateless `respond()` creates no
continuing memory. New browser loads and new sessions begin empty. Memory is not
written to a database or used as general knowledge.

### Basic and deterministic gates

`core/basic-phrases/` covers exact foundational exchanges before semantic
knowledge routing. Anchored arithmetic and premise-only reasoning from the
Extended Pack also run first so a graph mention cannot capture the operands of a
calculation.

### Typed semantic parser

`modules/semantic/` converts language into a `SemanticQuery`. Its declared
relations cover definitions, classifications, properties, geography, people,
quantities, processes, capabilities, composition, and relationships.

Entity resolution requires a known canonical name or alias. Relation detectors
run from specific to broad, prevent relation words embedded inside entity names
from self-triggering, and identify unsupported property frames before the broad
definition fallback. Conditions, quantities, time, answer style, and negation
remain explicit modifiers rather than disappearing during normalization.

The parser is mechanical. It has no statistical language representation and
does not infer an entity merely because two words seem semantically similar.

### Curated knowledge graph

`modules/knowledge-graph/` owns entities, aliases, predicates, propositions, and
indexes. A proposition records:

- one subject
- one typed predicate
- an entity, text, number, boolean, or list value
- optional scope, condition, time, unit, and provenance information

Data packs provide foundational taxonomies, science, everyday objects and
places, geography, people and works, technical concepts, processes, formulas,
and units. Capital-city entities receive derived country and continent
propositions during graph construction. Duplicate signatures are rejected
deterministically.

### Compositional reasoner

`modules/knowledge-graph/reasoner.ts` joins only inspectable facts:

- direct lookup uses one recorded proposition
- classification follows declared `is_a` links
- transitive classification joins a finite ancestor path
- inheritance exposes a predicate only when that predicate permits inheritance
- inverse and equivalent relations follow declared mappings
- boolean questions match their requested action or object before returning a
  verdict
- comparison requires both subjects to have the same requested relation

Every answer returns the propositions and a public `GraphProofStep[]`. Missing
facts return `undefined`; the engine can then try a bounded legacy source rather
than treating absence as a negative fact.

### Proposition realizer

`modules/proposition/` maps typed relations to reviewed English structures.
Open, boolean, count, and comparison responses are constructed from proposition
values and qualifiers. Style variants change presentation but do not multiply
or alter facts.

This is the architectural difference between DV6 and DV7: DV6 stored a complete
field answer for each topic; DV7 can reuse one atomic proposition across varied
questions, comparisons, follow-ups, and styles.

### Compatibility fallbacks

`modules/extended-pack/` remains the first compatibility fallback for authored
topic summaries, learning paths, conversation, and deterministic reasoning.
`modules/dictionary/` handles bounded Wordset definition forms for still-unknown
subjects. The original Search → Context → Connect → Structure route is retained
as the final example-context path.

These layers cannot silently override a successful graph answer.

## Traceability

Every reply returns a `LexiTrace` containing normalized input, sentence mode,
intent, confidence, evidence IDs, selected structure, and source. A graph reply
also exposes resolved subject IDs and human-readable proof steps. A combined
reply preserves ordered clause intents and aggregates proposition evidence.

The interface exposes this under “Why this response.”

## Coverage contracts

DV7 reports two deliberately separate measures:

1. **Semantic construction surface** counts executable combinations of actual
   benchmarkable propositions or actual same-relation subject pairs, supported
   question frames, and answer styles.
2. **Coverage benchmark** executes curated ordinary questions, stateful session
   scenarios, and one generated reachability question for each unique
   subject–predicate pair.

The benchmark classifies misses as parser, routing, content, proposition, or
memory failures. A larger graph is not accepted if the end-to-end route cannot
retrieve its records. See `docs/DV7_COVERAGE.md` for the exact formula and
current result.

## Release-history contract

`lib/lexi/releases.ts` is the single source for the interactive release graph.
Its capability index is an internal 0–100 historical index, not an external
benchmark. Verified availability and benchmark results remain separate
highlighted measurements. Every `LEXI_BUILD` change must add one newest release
record; tests enforce synchronization and chronological non-decrease.

## Known limits

DV7 still does not provide open-world inference, current/live information,
probabilistic ambiguity resolution, arbitrary multi-hop planning, or knowledge
outside its reviewed graph, dictionary, and corpora. A 3,211/3,211 benchmark
result means all checked-in cases pass; it does not mean every possible English
question will pass. Coverage should grow through reviewed propositions,
collision tests, and new real-world benchmark cases—not inflated permutations.
