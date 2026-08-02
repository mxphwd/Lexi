# DV9 reviewed-data inbox

Keep incoming material outside generated packs until it has been frozen,
reviewed, and assigned a stable source locator.

Recommended files for the next expansion:

- `entities.jsonl`: stable ID, canonical label, aliases, and declared type
- `facts.jsonl`: subject, predicate, typed object, qualifiers, and provenance
- `word-senses.jsonl`: lemma, sense ID, definition, usage restrictions, and source
- `dialogues.jsonl`: ordered turns, propositions, repairs, goals, and expected state
- `user-failures.jsonl`: untouched prompt, expected behavior, date, and failure class

Do not copy a failure into query-plan development examples until its blind
baseline has been recorded. Do not silently replace disputed facts; add a
separate proposition and a dispute link. Time-varying facts need validity dates.

The generated DV9 manifest intentionally reports zero new independently
reviewed facts and zero user-reported failure questions until material passes
this boundary.
