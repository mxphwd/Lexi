# Current development release: DV13

Build **260908-DV13**, 8 September 2026. Expanded question wording and proof follow-ups, inspectable trace evidence, and explicit feedback/evaluation review. This is a development build, not an RC; independent accuracy and confidence remain unverified. See [DV13 details](dv13/README.md).

# Lexi release-history rule

The interactive release graph records Lexi's architectural milestones. It was
introduced in build 260730-DV5, and its public history is consolidated into six
model eras rather than presenting every intermediate build as a new generation.

## Required action for every future version

Whenever `LEXI_BUILD` changes, review whether it establishes a distinct model
architecture or completes the current one. Add a new graph point only for a
distinct architectural milestone; otherwise append the build identifier and
verified changes to the current milestone in `lib/lexi/releases.ts`. A release
record must include:

1. the exact build identifier and human-readable version label
2. every historical source build consolidated into the milestone
3. a short graph label and release date range
4. a reviewed capability-index value
5. two or more specific update notes
6. one quantitative highlight when a verified measurement exists
7. separate measurement chips when a milestone reports multiple capabilities

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

The first milestone has no predecessor and is labelled as the baseline. Every
later tooltip calculates and displays its index change from the immediately
preceding architectural milestone. Exact build identifiers remain visible in
each tooltip and in the internal reports.

`tests/releases.test.ts` guards this rule by requiring the latest plotted build
to equal `LEXI_BUILD`.
