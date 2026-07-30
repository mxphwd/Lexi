# Extended Pack

The Extended Pack is the primary direct-answer layer in Lexi Language 1.0
Pre-build 260730-DV6. It is authored TypeScript data and routing
logic, not an example-sentence corpus and not a generative model.

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
semantic-routing modifiers, DV6 exposes 1,147 counted linguistic features—
exactly 800 more than DV5. The conservative direct-availability measure is
500,347 constructions, 7.02 times DV5's baseline.

To add coverage, add a topic to the appropriate file under `topics/`, give it a
unique ID, and test at least one definition plus one non-definition focus.
Unknown subjects continue to the Basic Phrases, Dictionary, and corpus modules.
