# Extended Pack

The Extended Pack is Lexi Language 1.0 Pre-build 260802-DV9's compatibility and
fallback layer. DV8 routes typed factual questions through its query engine and
first; the Extended Pack remains responsible for deterministic calculations,
complete conversation patterns, authored summaries and learning paths, and
subjects not yet promoted to atomic propositions. It is authored TypeScript data
and routing logic, not a generative model.

Each topic records:

- a canonical term and recognized aliases
- a direct definition
- purpose, mechanism, importance, and example fields
- optional components and reviewed related concepts

`question-frames.ts` declares 500 semantic question frames. `query.ts` orders
and parses them, `linguistic-features.ts` handles 158 non-semantic rewrites and
answer styles, and `router.ts` selects one explicit field and literal answer
structure. `conversation.ts` handles 247 complete conversational patterns.
`reasoning.ts` provides 100 bounded arithmetic, sequence, text, logic, and
decision forms.

Together with the Discourse Module's 118 reference rules and the 24 declared
semantic-routing modifiers, this frozen DV6 layer exposes 1,147 counted
linguistic features and 500,347 direct constructions. DV7 retains those values
as its historical availability baseline rather than changing their meaning.

To add coverage, add a topic to the appropriate file under `topics/`, give it a
unique ID, and test at least one definition plus one non-definition focus.
Unknown subjects continue to the Basic Phrases, Dictionary, and corpus modules.
