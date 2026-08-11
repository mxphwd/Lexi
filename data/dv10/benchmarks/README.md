# DV10 frozen human-question benchmark

This directory is evaluation-only. No Lexi runtime or development-data module
may import the questions, expected answers, baseline outputs, or failure labels.

`frozen-human-failures.jsonl.gz` contains 2,500 human-contributed questions
that the untouched DV9 engine failed to answer correctly. Each row preserves
the expected answer, DV9 output, outcome class, failure class, source category,
and difficulty.

The upstream snapshot comes from Open Trivia Database content distributed
under CC BY-SA 4.0. The exact repository blob and source SHA-256 are recorded in
`manifest.json`. Run the builder with an independently obtained copy of that
snapshot; never regenerate the frozen artifact after implementing a fix.

The pack measures factual question handling. Separate curated suites measure
ambiguity, correct abstention, word-sense selection, and multi-turn goals.
It is broad human-authored trivia, not a claim that every item is an ordinary
conversation question and not a substitute for private user interaction logs.
