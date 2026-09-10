# Lexi lexicon data

The active lexical data is the integrity-pinned, first-character-sharded
adaptation under `public/dv9/lexicon/`, referenced only through the DV12 runtime
catalog. The browser never downloads the complete dictionary.

The duplicate compact index, full vendored source archives and browser-loaded
Wordset archive were removed from the active tree during the DV6 cleanup. Their
exact historical inputs and build scripts remain recoverable from Git history.
Source notices and licenses remain here and under `public/lexicon/` because the
runtime shards are redistributed adaptations.
