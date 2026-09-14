# Current development version: DV13

Technical build **260908-DV13**, maintained through 10 September 2026. Expanded question wording and proof follow-ups, inspectable trace evidence, explicit feedback/evaluation review, and a deep removal of superseded runtime layers and unreferenced assets. The cleanup remains part of DV13 rather than creating a new development version. This is not an RC; independent accuracy and confidence remain unverified. See [current-build details](dv13/README.md).

# Lexi release-history rule

The interactive release graph records every Lexi development version. It was
introduced in build 260730-DV5. The public sequence runs from Initial build
through DV13, while each point retains its exact dated technical build.

## Required action for every future version

Whenever `LEXI_BUILD` changes, add one corresponding newest record to
`lib/lexi/releases.ts` in the same change. A release record must include:

1. the exact build identifier and human-readable version label
2. a short graph label and release date
3. a reviewed capability-index value
4. two or more specific update notes
5. one quantitative highlight when a verified measurement exists
6. separate measurement chips when a version reports multiple capabilities

Additional-data packs do not create new release points or new mother-version
identifiers. Increment the mother release's extensionLevel instead: AD1 is
shown as a superscript +1, AD2 as +2, and so on. Merge the pack's verified
counts and notes into that mother release while keeping the internal package
identifier available for compatibility and diagnostics.

Never manufacture a benchmark. The graph's capability index is an internal,
relative 0–100 development index built from deterministic response reach,
contextual precision, lexical coverage, and model transparency. Verified
measurements—such as DV4's 3.99× direct-answer availability and DV7's separately
defined semantic-construction surface—belong in the metric field. A construction
surface and an empirical question benchmark must remain labelled as different
measurements.

Beginning with DV8, releases prefer separate knowledge, language, reasoning,
dialogue, precision, and latency measurements over one synthetic availability
multiplier. A like-for-like gain must run both versions through the same
evaluator.

Beginning with DV9, large generated data releases must also disclose the
difference between schema-validated, source-attested, mechanically derived,
disputed, and independently reviewed facts. Generated held-out questions must
not be described as real user failures.

Beginning with DV10, every acceptance report must keep outcome classes
separate, publish the frozen artifact identity, and show unmet gates. A release
may not convert a failed factual suite into a capability multiplier. Sense,
dialogue, calibration, latency, language-route, reasoning, and factual-knowledge
surfaces remain separate measurements.

The Initial build has no predecessor and is labelled as the baseline. Every
later tooltip calculates and displays its index change from the immediately
preceding development version. Exact build identifiers remain visible in each
tooltip and in the internal reports.

`tests/releases.test.ts` guards this rule by requiring the latest plotted build
to equal `LEXI_BUILD`.
