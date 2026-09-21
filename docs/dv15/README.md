# Lexi DV15

DV15 is the first data-pack expansion built on the cleaned DV14 execution path. It adds exactly 550 Basic packs and 200 Advanced packs. Together they make 120,000 previously dormant, source-attested propositions executable through the same typed-plan, evidence, proof, and realization contract as Lexi's core knowledge.

## Pack surface

- 550 Basic packs: everyday knowledge, geography, natural science, and language mappings
- 200 Advanced packs: history and civics, computing, processes, causal explanations, natural science, and measurement
- 120,000 propositions
- 105,223 indexed entities
- 88 relation types and 186 relation aliases
- 467,868 normalized entity aliases

The facts are promoted from the existing CC0 source snapshot. “Source-attested” means the source recorded the claim; it does not mean Alphaine independently verified every claim. Claim-level source location, extraction method, confidence, date, license, and dispute state are retained.

## Processing architecture

The runtime does not load the collection at startup. A global alias index, entity index, and relation index select compatible packages after the first parse. The Worker loads at most six packs, 1,500 propositions, or 3 MiB of decoded pack data per request pass, relinks the entities, recompiles the plan, and executes it again. Loaded knowledge lives only in the request overlay.

Lexical senses remain separate from world entities. Pack manifests are strict and versioned; unknown fields, unsupported runtime versions, duplicate identifiers, bad references, type errors, missing provenance, and integrity failures are rejected before the store is mutated.

## Measurement boundary

All 750 packs and all 513 supporting index assets are hash-checked by the DV15 validator. Runtime regressions demonstrate that Basic and Advanced packs can be selected and answered with evidence under the resource budget. These disclosed checks are not an independent ordinary-question benchmark. DV15 therefore does not claim a 50–70% answer rate, and confidence remains unavailable until a separate held-out calibration population exists.
