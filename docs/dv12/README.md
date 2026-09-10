# Lexi DV12 development build

Build: 260904-DV12. Status: development, not RC. The requested 50–70% public-use answer rate has not been established.

This build replaces active legacy answer substitution with one typed execution path. It does not finish all 243 audit items. See [the complete implementation ledger](implementation-ledger.md) and its machine-readable JSON companion. The ledger retains the original requirements and distinguishes local implementation/test evidence, partial mechanisms, pending additions, and unavailable independent evidence.

## What runs

The browser sends a bounded request to /api/lexi/respond. The Worker normalizes and parses clauses, finds compatible evidence, loads integrity-pinned resources, rebinds arguments, executes typed operations, realizes bound answers, and returns a small response and transactional session state. Entire world packages do not travel to the browser.

The active implementation is modules/dv12. The superseded DV7–DV11 responder chain and completed-answer fallbacks were removed during the DV6 maintenance cleanup; their exact source remains in Git history. Legacy completed answers are never promoted to synthetic factual evidence.

Implemented operations include relational lookup, scoped ability verification, explicit negatives, inverses and symmetry, bounded inheritance/transitivity, typed positive-premise rules, filters, aggregates, measurement ordering, arithmetic precedence, fractions/percentages, dimension-checked conversion, bounded inventory transfers, subset/disjoint premise logic, basic temporal intervals, compound personal memory, deletion, references, and proof follow-ups. Each operation has limits: this is not a general English or unrestricted reasoning engine.

## Running and checking

- npm run dev: local interface and local API.
- npm run verify:dv12: strict types, runtime reachability, live-asset integrity, production build, client budgets, DV12 regressions, development diagnostics, and local performance checks.
- npm run gate:dv12:rc: deliberately fails until independent evidence, calibration, category coverage, and unresolved P0 work meet the gate.
- npm run dv12:build-indexes: rebuilds the DV12 catalog, 256 bounded alias buckets, and normalized packages.

The UI is preserved, including cancel lighting, the Alphaine entrance, and short release notes. DV11 AD1 remains one historical version with a +1 badge. DV12 is a new development point, without an invented improvement multiplier.

## Adding packages

Put authored normalized packages in data/dv12/packages/*.json. Start from language-bridge.json. Rebuild the catalog and run validation after changes. The manifest declares package ID, semantic version, runtime major 12/schema 1, and exact or caret dependency ranges. SHA-256 validates compressed and decoded bytes. Dependency cycles, version mismatch, invalid entity references and unsafe rule conclusions are rejected before an overlay is exposed.

Keep world entities, lexical senses and language examples separate. Package language entries are literal templates with one {subject} slot and an existing relation; they compile into plans. Package dialogue entries map literal utterances to supported previous-result operations. Typed rules have explicit premises/conclusions; they do not accept arbitrary executable code. Unsupported old descriptor families must be migrated and tested, not relabeled as implemented rules.

Facts require IDs, existing subjects, declared relations, typed objects, source identifiers/locations, review state, extraction method, and license. Quantities need explicit units. Changing claims require reviewed validity intervals; importing a file does not establish currentness. A normalized package is a versioned overlay: it cannot silently overwrite an existing fact. Replacement/removal of active claims remains a separately tracked limitation.

The live AD1 propositions remain available through source-predicate-preserving migration, but the retired DV11 browser/service adapter and its unused alias, entity, sense and domain indexes are gone. P36/P1376 direction, P31/P279 distinction, language/residence/birthplace distinctions and combined P61 semantics are retained. Only two reviewed cross-store identity links have been added; broad entity reconciliation is unfinished.

## Budgets and unsupported work

Requests allow at most 12,000 characters, 2,048 whitespace tokens and 24 top-level clauses. Execution defaults to 12,000 visited steps, depth 8 and 1.5 seconds per plan. The service has a 64 KiB body limit, a 20-second request deadline and two concurrent requests per isolate. Retrieval allows four passes and twelve AD1 shards per request. The immutable seed store has a 20 MiB estimate budget; request overlays have a 12 MiB estimate budget. Asset caches have a 12 MiB decoded-size-based estimate budget.

These budgets are safeguards, not proof of complete retrieval. Global rankings, universal claims and counts over an open universe remain insufficient unless completeness is explicitly established. Estimated allocation budgets are not exact heap measurements. Provider-wide rate limiting, exhaustive browser testing, rich condition graphs, counterfactuals, full event grammar, procedure branches and comprehensive ranked dialogue references remain unfinished.

## Evidence and measurement

data/dv12/evaluation/development.jsonl is frozen development diagnostic data, not blind or independent data. Answerability is fixed independently of what Lexi can currently answer. independent.jsonl is intentionally empty: generated prompts are not real user failures. All seven outcomes are separate. Uncertain textual equivalents require adjudication; resolved-case precision is accompanied by bounds including unresolved answers.

docs/dv12/evaluation-results.json contains per-question plans, output, outcomes and category samples. performance.json includes import-inclusive cold starts, file-backed package routes, a 300-turn session and OS high-water memory. It is local Node performance, not browser, network, or production performance.

Calibration fitting and versioned profile loading exist, but data/dv12/calibration/profiles.json is empty. Confidence is unavailable until human-judged held-out labels support fitted groups. The UI must not show a heuristic as a measured probability.

The feedback control is explicitly opt-in: review a redacted, editable local report and download it. Nothing is automatically retained or uploaded. Review exports before transferring them into an independent evaluation collection.

## Hosting and Pages

Normal Sites hosting runs the Worker and UI together. GitHub Pages serves only static assets; it cannot execute Lexi's Worker. Set LEXI_BACKEND_URL to an authorized backend's complete respond endpoint when building Pages, or set window.LEXI_BACKEND_URL before using it. The backend must allow the exact Pages origin and supply appropriate authentication; a private Sites endpoint is not automatically a cross-origin public API. Without configuration, Pages explicitly reports that server answers are unavailable. No silent older-engine fallback is enabled.

## Source checks

The small numeric foundation uses [NASA/JPL planetary physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html): mean diameters are twice the listed mean radii, with uncertainty scaled equally. This does not establish a complete universe of planets.

The AD1 mapping preserves [P61's combined discoverer/inventor meaning](https://www.wikidata.org/wiki/Property:P61) and reverses [P1376 capital-of](https://www.wikidata.org/wiki/Property:P1376) when normalizing to the forward capital relation. Existing AD1 labels and source claims are not independently re-reviewed by this migration.
