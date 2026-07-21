# Discourse Module

The Discourse Module is the deterministic multi-part layer introduced in Lexi Language 1.0 Pre-build 260721-0A.

It performs two bounded operations:

1. `segment.ts` separates up to four clauses at explicit sentence boundaries,
   at a coordinator followed by a new request form, or under a recognized shared
   frame. For example, “What is math and science?” becomes “What is math?” and
   “What is science?” Ordinary statements containing `and` remain intact.
2. `combine.ts` deduplicates identical answers, aggregates their evidence, and sends them to the reviewed combination structures in the Structure Module.

Every clause still passes through the ordinary Basic Phrases or Search → Context → Connect → Structure path. No response text is predicted, and no new fact is introduced during combination.
