# Lexi lexicon data

`vendor/` contains the complete source artifacts requested for Lexi.
`scripts/build-lexicon-index.mjs` reads both sources offline and creates the
deterministic `runtime-index.json` used by Search and Connect for ordinary
conversation.

Definition requests use a second bounded path. The unmodified compressed
Wordset archive is copied to `public/lexicon/wordset-dictionary.json.gz`, loaded
on first use, decompressed by the browser, and cached for the session. This gives
Lexi access to every entry without adding the uncompressed dictionary to the
JavaScript bundle. `public/lexicon/ATTRIBUTION.txt` and
`public/lexicon/WORDSET-LICENSE.txt` travel with the deployed copy.

To add runtime vocabulary, edit the `selectedTerms` list in that script and run:

```bash
npm run lexicon:build
```

Review the generated definitions and relations before accepting the change.
Moby relations are broad thesaurus associations, not always strict synonyms;
applications that need narrow synonymy should add a reviewed relation type.

DV9 additionally compiles the complete sources into first-character shards
under `public/dv9/lexicon/`. These preserve explicit Wordset senses and bounded
Moby associations while avoiding a full-dictionary download for every lexical
question. Run `npm run dv9:build-data` and `npm run dv9:validate-data` after
changing either vendored source.
