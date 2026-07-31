# Session Memory

`LexiSessionMemory` stores explicit user-provided name, age, location,
preferences, previous turns, and resolved active subjects for one session.
`createLexiSession()` owns that state; the stateless `respond()` function does
not retain it.

Memory is deterministic, inspectable, bounded, and non-persistent. It is not
written to the knowledge graph or shared between users.
