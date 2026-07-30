# Extended Pack

The Extended Pack is the primary direct-answer layer introduced in Lexi
Language 1.0 Pre-build 260730-DV3. It is authored TypeScript data and routing
logic, not an example-sentence corpus and not a generative model.

Each topic records:

- a canonical term and recognized aliases
- a direct definition
- purpose, mechanism, importance, and example fields
- optional components and reviewed related concepts

`router.ts` recognizes definition, purpose, mechanism, importance, example,
component, relation, and comparison question frames. It selects one explicit
field and one literal answer structure. `conversation.ts` handles broader
complete conversational phrases that should not require corpus matching.

To add coverage, add a topic to the appropriate file under `topics/`, give it a
unique ID, and test at least one definition plus one non-definition focus.
Unknown subjects continue to the Basic Phrases, Dictionary, and corpus modules.
