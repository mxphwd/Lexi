# DV9 data engine

- `types.ts`: provenance, uncertainty, lexical-plan, shard, and dialogue types
- `schema.ts`: manifest, provenance, and runtime-entry validation
- `normalize.ts`: punctuation- and diacritic-safe lexical normalization
- `parser.ts`: compositional lexical question plans
- `loader.ts`: on-demand compressed shard loading and caching
- `realizer.ts`: explicit-sense and provenance-aware answers
- `dialogue.ts`: lexical propositions, goals, sense position, and topic stack
- `index.ts`: public DV9 integration and measured statistics

Large development resources are generated under `data/dv9/packs/`. Runtime
shards are served from `public/dv9/lexicon/`.
