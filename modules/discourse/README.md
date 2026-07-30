# Discourse Module

The Discourse Module is Lexi's deterministic multi-part layer.

It performs two bounded operations:

1. `segment.ts` separates up to four clauses at explicit sentence boundaries,
   at a coordinator followed by a new request form, or under a recognized shared
   frame. For example, “What is math and science?” becomes “What is math?” and
   “What is science?” It also carries an explicit subject into bounded follow-up
   forms: “What is math and why is it important?” becomes a definition request
   plus “Why is math important?” `reference.ts` contains 42 singular and 16
   paired reference forms. A third possible antecedent stops plural resolution
   and requests clarification instead of selecting the last two. Ordinary
   statements containing `and` remain intact.
2. `combine.ts` deduplicates identical answers, aggregates their evidence, and sends them to the reviewed combination structures in the Structure Module.

Every clause still passes through Basic Phrases, the Extended Pack, or the
Search → Context → Connect → Structure fallback path. No response text is
predicted, and no new fact is introduced during combination.
