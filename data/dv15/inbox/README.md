# DV15 package inbox

This directory is the handoff point for a separate Lexi data-generation chat. A generator may add unpacked `*.json` files under `basic/<category>/` or `advanced/<category>/`. The runtime never reads this directory directly: the main build validates the files, compiles them into gzip packs, and updates the catalog and shard indexes consumed by the Worker.

## What Lexi actually loads

Lexi does not load arbitrary prose or a folder of example answers. The live DV15 path loads a strict `DataPack` containing typed entities, relation schemas, and source-attested facts. A request uses the global alias/entity/relation indexes to select compatible packs, loads only the selected packs behind the Worker boundary, installs them as a request-local overlay, and executes the typed query plan. Lexical senses remain separate from world entities.

## Staging contract

Each file must be one complete pack with exactly these top-level keys:

```json
{
  "manifest": {
    "id": "alphaine.lexi.dv15.basic.geography.901",
    "version": "15.0.0",
    "tier": "basic",
    "category": "geography",
    "runtime": { "major": 12, "schema": 2 },
    "sourceSnapshot": "2026-09-28",
    "propositionCount": 100,
    "entityCount": 2,
    "relationCount": 1
  },
  "relations": [],
  "entities": [],
  "facts": []
}
```

The example above is only a shape illustration; a real pack must contain 100–256 facts and every fact's subject and object must be entities declared in that same pack. Pack IDs are stable and must match `alphaine.lexi.dv15.<basic|advanced>.<category>.<three-digit-sequence>`. Categories are lowercase kebab-case. Use a new sequence number; never replace an existing published pack in place.

Required quality rules:

- Give every entity a stable namespaced ID, canonical name, normalized aliases, type, and domain.
- Give every relation normalized aliases plus domain/range, inverse/symmetry/transitivity/functionality, temporal behavior, dimension, frame, and open/closed-world policy.
- Give every fact a unique ID, typed entity object, and claim-level provenance (`id`, `location`, `method`, `review`, `license`, and source date/confidence where available).
- Keep facts atomic and composable. Do not write finished answers, benchmark expected answers, or parser templates into a pack.
- Do not copy anything from evaluation-only failure sets, adjudication queues, or benchmark fixtures. Those datasets are deliberately outside the development-pack boundary.
- Preserve source licenses and locations. “Source-attested” means the source recorded the claim; it is not an Alphaine verification guarantee.

## Handoff workflow

1. The generation chat writes packs only into this inbox, never into `public/dv15`, `worker/`, or runtime modules.
2. Run `npm run dv15:validate-inbox`. It validates every staged pack, checks cross-pack ID collisions and manifest consistency, and emits a machine-readable report in `artifacts/dv15-inbox-validation.json`.
3. The integration chat reviews the report, runs the pack compiler, and regenerates `public/dv15/catalog.json.gz`, pack files, indexes, `data/dv15/pack-manifest.json`, and `worker/dv15-integrity.ts` together.
4. Run the DV15 validation and tests before committing. A pack is not live merely because it exists in this inbox.

For linguistic or dialogue material, first convert each supported claim into typed entities and relations. Raw paragraphs are not a runtime package format; adding a new prose/context format would require a versioned compiler and executor contract rather than silently placing text beside the packs.
