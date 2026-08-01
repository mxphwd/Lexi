# Lexi DV8 architecture

## Contract

Lexi is deterministic and source-bound. It can read a recorded fact, join facts
through a declared rule, run a bounded transformation, realize the resulting
proposition, use an attributed dictionary definition, match a reviewed example,
or abstain. It cannot create a factual edge that is absent from those sources.

```text
English input
  → bounded clause segmentation and session memory
  → normalization, morphology, and compiled word-sense resolution
  → typed QueryPlan (patterns, variables, filters, modifiers, operation)
  → normalized fact indexes plus proposition-aware dialogue state
  → deterministic joins, rules, comparisons, aggregates, and truth checks
  → reviewed answer realization
  → answer + fact IDs + proof, or calibrated abstention
```

## Typed query language

`modules/dv8/types.ts` declares seven operations: `lookup`, `ask`, `select`,
`aggregate`, `compare`, `transform`, and `clarify`. Triple patterns contain
entity, variable, text, number, or boolean terms. Filters cover class/kind,
literal comparison, containment, time, and conditions. Quantifiers distinguish
any, all, none, and exact claims.

`modules/dv8/parser.ts` builds this representation. It does not execute a fact
while parsing and does not store one finished answer per wording.

## Compiled lexical senses

`modules/dv8/lexicon.ts` compiles canonical names, aliases, and lemmatized forms
into a token trie once. Prompt resolution walks input tokens rather than
constructing a regular expression for every alias. Every alias retains all of
its senses. A unique context-compatible kind can select a sense; otherwise the
plan asks for clarification.

## Normalized fact indexes

`modules/dv8/facts.ts` creates an indexed view without destroying source
propositions. Lists become atomic facts. Safe references become entity edges.
Numbers and units are normalized, while proposition ID, qualifiers, and source
remain attached. The store indexes subject–predicate, predicate, and
predicate–object access.

## Execution

`modules/dv8/executor.ts` runs:

- direct and inverse indexed lookup
- multi-pattern joins and class/kind filters
- classification paths, transitivity, and declared inheritance
- distinct count aggregates and unit-compatible comparisons
- functional-property false answers when a different value is explicit
- boolean negatives and three-valued yes/no/unknown semantics
- any/all/none quantifiers over recorded class members
- condition compatibility and contradiction checks
- temporal refusal for time-varying predicates without dated evidence

Every result includes the facts and rule steps that produced it. Missing support
returns unknown; it is not turned into a positive statement by a lexical
fallback.

## Routing and abstention

Foundational phrases, bounded calculations, and established conversation
repairs remain deterministic gates. A factual plan uses the DV8 executor. If a
known subject is paired with an unsupported property, Lexi names the property
and abstains before the example corpus. Non-factual interactions such as time,
date, directions, and emotional support can still use reviewed compatibility
records.

## Dialogue

`modules/dv8/dialogue.ts` stores up to 24 session-local turn propositions:
subjects, relation, fact IDs, question, answer, proof, and goal. It supports
proof, simplification, active-subject, and goal follow-ups. Personal details
remain in `modules/memory/`. Nothing persists across sessions.

## Measurement and limits

DV8 reports knowledge, language robustness, reasoning, dialogue, precision, and
latency separately. `modules/benchmark/dv8.ts` runs a 4,124-case stateless suite,
120 dialogue sessions, and the frozen DV7 path on the same stateless cases.

Passing the suite does not imply universal language or knowledge. The graph is
small, many values still originate as reviewed free text, transformations are
bounded, time-sensitive facts need qualified sources, and the parser cannot
resolve every English construction. Add real failures blindly before fixes.
