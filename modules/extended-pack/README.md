# Extended Pack

This directory now contains only the Extended Pack source records still used by
the DV12/DV13 typed runtime. The old completed-answer router, conversational
fallback, rewrite engine and standalone reasoning path were removed.

Each topic records:

- a canonical term and recognized aliases
- a direct definition
- purpose, mechanism, importance, and example fields
- optional components and reviewed related concepts

`question-frames.ts` and `dv6-question-frames.ts` supply audited grammatical
forms to `modules/dv12/grammar-plugins.ts`. `topics/` supplies atomic fields to
the current base store. They do not realize completed answers independently.

To add coverage, add a topic to the appropriate file under `topics/`, give it a
unique ID, and test at least one definition plus one non-definition focus.
Unknown subjects remain unknown unless the current typed store or an on-demand
package supplies compatible evidence.
