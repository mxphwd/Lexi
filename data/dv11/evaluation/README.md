# DV11 independent evaluation data

Everything in this directory is evaluation-only. Runtime code and development-pack builders must never import it.

`real-user-failures.jsonl` is populated only by the opt-in failure recorder and an independent reviewer. A valid row records the original prompt, expected behavior, pre-request dialogue snapshot, observed output, provenance, one primary failure class, and an immutable SHA-256 row hash. The release gate requires 2,000–5,000 verified rows. Synthetic prompts, OpenTDB questions, generated paraphrases, and development examples are rejected as substitutes for real failures.

`ordinary-questions.jsonl` is a small schema fixture, not the release benchmark. The real blind set must stay outside runtime and development packs and must be expanded by independent review across all eleven declared categories.

The manifest records hashes and counts. Re-hash only through the review workflow; never edit a frozen row in place. Correct a row by superseding it in a new version.
