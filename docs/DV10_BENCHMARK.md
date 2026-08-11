# DV10 human-question evaluation

DV10 replaces headline availability multiplication with an independently
frozen failure benchmark. The primary pack contains 2,500 human-contributed
questions with known answers that the untouched DV9 public engine failed.

The source snapshot contains 4,738 Open Trivia Database questions under CC
BY-SA 4.0. DV9 was executed end to end until 2,500 failures were observed. The
frozen pack records the question, expected answer, source category and
difficulty, DV9 response, confidence, route, outcome, and failure class.

Runtime code never imports the pack. DV10 reports these outcomes separately:

- correct answer
- correct abstention
- incorrect answer
- unsupported abstention
- clarification

It also reports knowledge, language robustness, reasoning, dialogue,
precision, sense selection, confident-error rate, and latency. The 88–92%
ordinary correctness objective is a target, not a release claim. Any unmet gate
remains visible and no improvement multiplier is published.

The sense, dialogue, and calibration suites are separate deterministic
regression surfaces. They do not replace the human-question pack.

## Measured DV10 result

The current frozen-pack run records:

- 0 correct answers
- 0 correct abstentions (every source item is answerable)
- 287 incorrect answers
- 2,141 unsupported abstentions
- 72 clarifications
- 3.40% confidently incorrect answers
- 35.0% recognized language routes
- 0.0% factual-pack reasoning success
- 120.48 ms p95 end-to-end latency in the local release run

The separate deterministic surfaces record 100/100 explicit sense selections,
100/100 multi-turn dialogue goals, and 10/10 calibration probes. These small
declared surfaces test the new mechanism; they are not evidence of universal
coverage.

The 88–92% ordinary-question target is not met. OpenTDB is a broad factual and
trivia source, not a substitute for the maintainer's real interaction failures,
so future user-reported failures should be added as a new frozen collection
without changing this artifact. No improvement multiplier is published.
