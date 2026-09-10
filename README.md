# Lexi

Lexi (from “Lexicon”) is Alphaine’s experimental, deterministic, rule-based language engine. It maps supported English into explicit operations, uses recorded evidence, and explains or declines an answer without generative AI at runtime.

Current development version: **DV6**. Current technical build: **260908-DV13**, dated 8 September 2026. **Not a release candidate.** Public-use accuracy and confidence calibration have not been established.

The current build expands equivalent question wording and proof follow-ups while retaining explicit evidence requirements. A DV6 maintenance cleanup removed superseded responder stacks and unreferenced assets; its evaluation workflow still separates authored regressions, reviewed real-use failures, and held-out evidence.

## Run locally

Requires Node 22.13 or later.

```sh
npm ci
npm run dev
```

Try “Which city is the capital of France?”, “What is 20 percent of 50?”, or “Can penguins fly?”, then “Why?”.

## Verify and review

```sh
npm run verify:dv13
npm run gate:dv13:rc
```

The development verification checks types, data integrity, release metadata, the production build, delivery budgets, regressions and diagnostics. The RC gate intentionally fails until independent evidence, calibration and inherited critical requirements meet its thresholds.

- [How it works](docs/ARCHITECTURE.md)
- [DV13 changes and limitations](docs/dv13/README.md)
- [DV6 maintenance cleanup audit](docs/DV6_MAINTENANCE_CLEANUP.md)
- [Evaluation and feedback review](data/dv13/evaluation/README.md)
- [Release history](docs/RELEASES.md)

GitHub Pages is a static preview and needs `LEXI_BACKEND_URL` configured to an authorized response endpoint. Normal Sites hosting includes the server. See [the hosting boundary](docs/dv12/README.md#hosting-and-pages).
