# Knowledge Graph

This module is DV8’s curated source graph. `modules/dv8/facts.ts` compiles its
propositions into the normalized forward and inverse execution indexes.
`data/` contains reviewed entity seeds; `graph.ts` builds deterministic indexes
and derived location facts; `predicates.ts` declares relation behavior; and
`reasoner.ts` retrieves or joins propositions while returning proof steps.

Prefer small atomic propositions over finished prose answers. Qualify scope,
condition, time, and units explicitly. Do not add an alias unless it names the
same entity.
