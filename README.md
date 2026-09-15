# Lexi

Lexi (from “Lexicon”) is Alphaine’s experimental, deterministic, rule-based language engine. It maps supported English into explicit operations, uses recorded evidence, and explains or declines an answer without generative AI at runtime.

Current development version: **DV14**. Current technical build: **260915-DV14**, dated 15 September 2026. **Not a release candidate.** Public-use accuracy and confidence calibration have not been established.

The current build introduces a span-preserving compositional language layer, canonical identity mappings, composite retrieval indexes, four-valued conflict handling, verified answer clauses, richer discourse state, and stricter request/package/response validation. Its evaluation workflow still separates disclosed development regressions from independent and calibration evidence.

## Run locally

Requires Node 22.13 or later.

```sh
npm ci
npm run dev
```

Try “Which city is the capital of France?”, “What is 20 percent of 50?”, or “Can penguins fly?”, then “Why?”.

## Verify and review

```sh
npm run verify:dv14
npm run gate:dv14:rc
```

The development verification checks types, data integrity, release metadata, the production build, delivery budgets, regressions and diagnostics. The RC gate intentionally fails until independent evidence, calibration and inherited critical requirements meet its thresholds.

- [How it works](docs/ARCHITECTURE.md)
- [DV13 changes and limitations](docs/dv13/README.md)
- [DV14 changes and limitations](docs/dv14/README.md)
- [DV13 maintenance cleanup audit](docs/DV13_MAINTENANCE_CLEANUP.md)
- [Evaluation and feedback review](data/dv13/evaluation/README.md)
- [Release history](docs/RELEASES.md)

GitHub Pages is a static preview and needs `LEXI_BACKEND_URL` configured to an authorized response endpoint. Normal Sites hosting includes the server. See [the hosting boundary](docs/dv12/README.md#hosting-and-pages).
