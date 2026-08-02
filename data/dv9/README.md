# DV9 generated data

Run `npm run dv9:build-data` to reproduce the compressed packs and runtime
shards from the vendored Wordset and Moby sources. Run
`npm run dv9:validate-data` before accepting a generated change.

`manifest.json` is the authoritative inventory and provenance record. Packs are
JSON Lines compressed with gzip. Their tuple layouts are generated and consumed
only by the DV9 build, validation, and benchmark scripts; the browser loads the
smaller term shards under `public/dv9/lexicon/`.

Do not edit generated gzip files manually. Change the generator or reviewed
source material, regenerate, validate, and inspect the resulting manifest.
