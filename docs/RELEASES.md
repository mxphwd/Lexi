# Lexi release-history rule

The interactive release graph is a permanent part of Lexi beginning with
Pre-build 260730-DV5.

## Required action for every future version

Whenever `LEXI_BUILD` changes, add one corresponding newest record to
`lib/lexi/releases.ts` in the same change. A release record must include:

1. the exact build identifier and human-readable version label
2. a short graph label and release date
3. a reviewed capability-index value
4. two or more specific update notes
5. one quantitative highlight when a verified measurement exists
6. separate measurement chips when a version reports multiple capabilities

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

The first release has no predecessor and is labelled as the baseline. Every
later tooltip calculates and displays its percentage change from the immediately
preceding point.

`tests/releases.test.ts` guards this rule by requiring the latest plotted build
to equal `LEXI_BUILD`.
