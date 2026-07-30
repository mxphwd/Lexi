# Extended Pack

The Extended Pack is the primary direct-answer layer in Lexi Language 1.0
Pre-build 260730-DV4. It is authored TypeScript data and routing
logic, not an example-sentence corpus and not a generative model.

Each topic records:

- a canonical term and recognized aliases
- a direct definition
- purpose, mechanism, importance, and example fields
- optional components and reviewed related concepts

`question-frames.ts` declares 164 semantic question frames. `query.ts` orders
and parses them, `linguistic-features.ts` handles 58 non-semantic rewrites and
answer styles, and `router.ts` selects one explicit field and literal answer
structure. `conversation.ts` handles 67 complete conversational patterns that
should not require corpus matching.

Together with the Discourse Module's 58 reference rules, DV4 exposes 347
counted linguistic features. The conservative direct-availability measure is
71,243 constructions, 3.99 times DV3's baseline.

To add coverage, add a topic to the appropriate file under `topics/`, give it a
unique ID, and test at least one definition plus one non-definition focus.
Unknown subjects continue to the Basic Phrases, Dictionary, and corpus modules.
