# Lexi lexicon data

`vendor/` contains the complete source artifacts requested for Lexi. The web
interface does not parse tens of megabytes at runtime. Instead,
`scripts/build-lexicon-index.mjs` reads both sources offline and creates the
deterministic `runtime-index.json` used by Search and Connect.

To add runtime vocabulary, edit the `selectedTerms` list in that script and run:

```bash
npm run lexicon:build
```

Review the generated definitions and relations before accepting the change.
Moby relations are broad thesaurus associations, not always strict synonyms;
applications that need narrow synonymy should add a reviewed relation type.
