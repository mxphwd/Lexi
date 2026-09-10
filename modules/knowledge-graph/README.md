# Knowledge Graph

This directory contains the curated seed graph still imported by the current
DV12/DV13 base store. `data/` holds entity seeds and `graph.ts` normalizes them
and derives reviewed capital/location records before `modules/dv12/store.ts`
migrates them into the active typed store. The retired DV7/DV8 query executors
and graph-specific reasoner were removed; this source data remains because it
is live, not as a historical fallback.

Prefer small atomic propositions over finished prose answers. Qualify scope,
condition, time, and units explicitly. Do not add an alias unless it names the
same entity.
