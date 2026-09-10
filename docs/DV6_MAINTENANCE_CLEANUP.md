# DV6 maintenance cleanup

Date: **10 September 2026**

Technical build: **260908-DV13** (unchanged)

Public development milestone: **DV6** (unchanged)

## Decision rule

This cleanup removes a path only when both conditions are true:

1. it belonged to a previous Lexi mechanism or build-time workflow; and
2. the production entry points, the current DV12/DV13 engine, the current tests,
   and the current data catalog no longer import or reference it.

Historical documentation and every resource referenced by the current catalog
remain in place. A historical path is not removed merely because it is old, and
a live shard is not removed merely because it retains a DV9 or DV11 directory
name. Git history remains the recovery record for deleted implementation files
and source archives.

## Runtime reachability review

The production dependency graph is traced from the four shipped entry points:

- `app/page.tsx`
- `app/layout.tsx`
- `worker/index.ts`
- `github-pages/main.tsx`

The retained production graph contains 54 authored source files. It reaches the
DV12 typed execution engine, DV13 response refinements, the active knowledge
seed, current semantic frames, the release interface, and the Worker-side
catalog loader. The old DV7–DV11 responders were parallel implementations and
were not reachable through the current request path.

## Removed implementation layers

- The superseded DV7, DV8, DV9, DV10, and DV11 parser, router, executor,
  dialogue, realization, benchmark, and memory trees.
- The pre-typed Search/Context/Connect/Structure orchestration, basic-phrase
  responder, historical engine bridge, and unused dictionary facade.
- The obsolete `/api/lexi/resources` and `/api/lexi/lexical` route and its
  resource loader. All current browser requests continue to use
  `/api/lexi/respond` and the DV12 Worker executor.
- Unreachable extended-pack responders and feature catalogs. The question-frame,
  topic, and type definitions still consumed by DV12 are retained.
- Unused knowledge-graph, search, and semantic barrel/parser files. The live
  graph seed, tokenizer, semantic relation frames, and types are retained.
- Historical benchmark runners, corpus generators, pack generators, ingestion
  utilities, and tests tied exclusively to the retired engines.
- The obsolete DV11 CI workflow. DV13 verification remains the active gate.

## Removed dormant data and public resources

- Dormant example-context corpora, old benchmark data, and superseded DV9–DV11
  development-pack source trees that were not imported by production or the
  current evaluation workflow.
- Local Wordset and Moby source archives after confirming the deployed lexical
  shards are self-contained. Their license and attribution notices are retained;
  the exact former archives remain recoverable from repository history.
- The obsolete public Wordset monolith, the previous social image, and DV9
  manifest.
- DV11 alias, entity, sense, domain, and predicate indexes not referenced by the
  current loader, plus four orphaned package/compiled-language files.

The current catalog still references and retains the live world packages,
subject/object/predicate indexes, DV12 alias buckets, DV9 lexical shards, and
DV11 lexical alias buckets. Their older directory labels describe data lineage,
not active engine versions.

## Catalog and loader cleanup

The two source catalogs required only when rebuilding the DV12 catalog moved
from public hosting into `data/dv12/source-catalogs`. The generated public
catalog now contains only runtime-readable metadata. Unused world-domain,
world-entity, lexical-domain, lexical-entity, lexical-sense, and
lexical-predicate index declarations were removed.

The catalog was rebuilt as mapping version `12.1.0-clean`. Its compressed size
fell from 385,170 bytes to 312,472 bytes (18.9%), and its decoded size fell from
1,465,993 bytes to 1,251,038 bytes (14.7%). The content hash and Worker integrity
constant were regenerated from the cleaned catalog.

## Permanent safeguards

`npm run audit:cleanup` now:

- traces imports from every production entry point using the TypeScript syntax
  tree;
- rejects any reintroduction or runtime import of a retired path;
- enumerates every asset referenced by the current catalog;
- verifies each referenced asset's SHA-256 digest and byte size; and
- rejects newly orphaned public files outside the explicit static allowlist.

The current result is 3,129 referenced public resources containing 115,355,449
bytes, with no missing, altered, or unreferenced catalog asset.

## Footprint and verification

Before cleanup, the repository tracked 4,336 files containing 233,509,500 bytes.
The cleaned source tree contains 3,275 files containing 119,941,165 bytes before
ignored build output: 1,061 fewer files and 113,568,335 fewer bytes (48.6%). The
production server entry is 1,236,683 bytes (about 1,208 KiB), compared with the
previous build report of about 1,308 KiB.

Strict type checking, linting, current DV12 and DV13 tests, release-history
tests, catalog integrity validation, production builds, GitHub Pages generation,
and current evaluation scripts are required to pass before this cleanup is
published. The completed check ran 43 current-runtime tests with no failures;
the delivery budget, catalog audit, development evaluation, and local
performance suite also passed. RC gating remains blocked because there are no
independent evaluation rows and unresolved inherited requirements remain.

This maintenance does not claim higher answer accuracy. It removes dead server
code, duplicate implementation surfaces, and unreferenced deployment weight;
production response latency must still be measured independently after
deployment.
