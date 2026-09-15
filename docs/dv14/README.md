# Lexi DV14

DV14 is a development build, technical build **260915-DV14**. It is not a release candidate, and no public-use answer-accuracy percentage is claimed.

## What changed

- Added a lossless Unicode tokenizer, conservative morphology, syntactic inventory, span-preserving semantic IR, semantic interpreter, and typed plan compiler. Existing exact constructions remain as compatibility candidates behind the same plan executor.
- Added role-correct capital and invention alternations, three-way subject coordination, multi-property clause expansion, scoped negation, multiword quantifiers, temporal intervals, explicit comparison metrics, percentage arithmetic, and a bounded nested-join plan.
- Added reviewed canonical source-to-core identity mappings and reviewed relation contracts for high-value relations.
- Added subject–predicate, predicate–object, and entity-type shard indexes. Retrieval now reports page/byte/frontier coverage and uses deterministic compatibility scoring with bounded discovery and adaptive hard limits.
- Preserved positive and negative evidence under four-valued truth (`true`, `false`, `unknown`, `conflict`) and retained all source assertions during AD1 migration.
- Added typed event and reviewed procedure package contracts, procedure-source enforcement, and multi-owner request-local inventory reasoning.
- Added bounded discourse records, targeted subject corrections, transactional state, sentence-level answer claims, claim provenance, and a raw confidence feature vector.
- Added strict request, imported-package, plan, response, identity, and composite-index validation.
- Added a grammar deprecation ledger so legacy constructions remain bounded compatibility paths with explicit removal criteria instead of becoming a second engine.

## Evidence boundary

The DV14 structural suite contains 14 disclosed development cases plus code-level regressions. These cases were used to build DV14 and are not independent evidence. The independent and calibration cohorts remain empty; the RC gate therefore remains closed. Confidence stays unavailable rather than presenting parser scores as probabilities.

The release graph’s **84/100** is an engineering-maturity index, not answer accuracy. It reflects the architectural work above and is capped by the missing blind and calibration evidence.

## Known limits

- The compositional parser covers the new structural families but is not yet a general weighted chart parser for unrestricted English.
- Nested joins can be planned and retrieved incrementally, but many cannot complete because the imported graph lacks reviewed joinable edges or complete identity mappings.
- Conditions and events have typed package contracts; broad conditional, counterfactual, and event-role execution remains incomplete.
- Lexical sense selection still needs a larger reviewed context set. Conservative spelling correction is not enabled.
- Translation, creative writing, summarization, recommendations, live news, and open-ended planning remain outside the deterministic capability contract.
- Production-wide admission control and authenticated cross-origin hosting are deployment concerns and are not supplied by the local isolate counter.

Run `npm run verify:dv14` for the development gate. `npm run gate:dv14:rc` is expected to fail until the independent evidence requirements are met.
