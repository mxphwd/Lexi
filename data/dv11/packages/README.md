# DV11 additional-data packages

DV11AD packages use the `Dv11KnowledgePackage` contract. Each package contains a manifest plus four typed arrays: `entities`, `propositions`, `schemas`, and `senses`. Runtime installation is atomic: schema, referential-integrity, value-range, dependency, count, identity, and content-hash checks complete before indexes are exposed.

- Give every entity, proposition, sense, schema, and package a globally stable namespaced ID.
- Use schema version `1`, minimum runtime `DV11`, and an immutable content hash.
- Declare every dependency and load packages through `Dv11PackageRegistry`; do not import package data from the core bundle.
- Put claim-level provenance on every proposition, including source location, extraction method, review status, confidence, creation date, validity, license, and dispute status where applicable.
- Use typed entity references, numbers, quantities, ranges, lists, sets, dates, or booleans. Do not encode structured values inside prose.
- Never include evaluation prompts, answers, hashes, templates, or distinctive phrases.
- Package additions may increase knowledge recall but must not change parser or evaluator behavior. Run `npm run dv11:validate-packages` and all regression suites before release.

Large packages should be sharded by route/domain. Register only their manifests at startup and lazy-load their payloads on a compatible route. The registry deduplicates concurrent loads and bounds parsed-payload memory.
