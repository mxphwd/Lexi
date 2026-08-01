# Lexi benchmarks

The benchmark executes questions through Lexi’s public engine and classifies
failures as parser, routing, content, proposition, or memory misses.

Run:

```bash
npm run benchmark:dv7
```

Add real user failures to the curated benchmark before fixing them. Generated
reachability checks ensure every unique graph subject–predicate pair remains
answerable, but they do not replace ordinary-language cases.

DV8 adds a separate 4,124-case stateless blind suite, 120 dialogue sessions,
six category measurements, latency sampling, and a frozen DV7 comparison:

```bash
npm run benchmark:dv8
```

See `docs/DV8_BENCHMARK.md` for the method and current result.
