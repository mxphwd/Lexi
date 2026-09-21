# Lexi

Lexi (from “Lexicon”) is Lexi Lab’s experimental, deterministic, rule-based language engine. It maps supported English into explicit operations, uses recorded evidence, and explains or declines an answer without generative AI at runtime.

Current development version is build version **DV15** or build number **260921-DV15**.


## Run locally

Requires Node 22.13 or later.

```sh
npm ci
npm run dev
```

Try “Which city is the capital of France?”, “What is 20 percent of 50?”, or “Can penguins fly?”, then “Why?”.

## Verify and review

```sh
npm run verify:dv15
```

The development verification checks types, data integrity, release metadata, the production build, delivery budgets, regressions and diagnostics. The RC gate intentionally fails until independent evidence, calibration and inherited critical requirements meet its thresholds.

- [How it works](docs/ARCHITECTURE.md)
- [DV13 changes and limitations](docs/dv13/README.md)
- [DV14 changes and limitations](docs/dv14/README.md)
- [DV15 packs, processing and limitations](docs/dv15/README.md)
- [DV13 maintenance cleanup audit](docs/DV13_MAINTENANCE_CLEANUP.md)
- [Evaluation and feedback review](data/dv13/evaluation/README.md)
- [Release history](docs/RELEASES.md)

Model tests and benchmarks are conducted and provided using **GPT-5.6 Terra and Sol** models on **ChatGPT Codex**.
> Ironic scene where Lexi, an attempt to make zero-AI LLM, is tested using an AI LLM. Let's forget about this and save my precious time.
