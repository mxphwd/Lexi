# DV7 Benchmark

The benchmark executes questions through Lexi’s public engine and classifies
failures as parser, routing, content, proposition, or memory misses.

Run:

```bash
npm run benchmark:dv7
```

Add real user failures to the curated benchmark before fixing them. Generated
reachability checks ensure every unique graph subject–predicate pair remains
answerable, but they do not replace ordinary-language cases.
