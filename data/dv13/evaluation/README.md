# DV13 evaluation and feedback review

The runtime never imports this directory. Manifest hashes freeze each corpus. `baseline` references the unchanged 62 DV12 diagnostics; `paraphrases` contains authored DV13 regressions and scope guards. Neither is independent evidence. `real-failures` and `independent` begin empty. `adjudications.json` also begins empty.

## Admit a real-use report

1. A user explicitly previews, edits and downloads feedback from Lexi. Including preceding visible prompts is separately opt-in. Automatic redaction can miss private information, and visible context can be incomplete.
2. Stage that local export without admitting it:

   ```sh
   npm run feedback:dv13:stage -- /path/to/feedback.json .local/dv13/review.json
   ```

3. A human edits the draft. Supply a category, answerability defined independently of current Lexi behavior, a typed expected answer (or explicitly approved text/clarification), reviewer identity, review date and source/rationale in `review.evidence`. Confirm consent to inclusion and sharing in this repository, privacy review, expected-answer approval and complete replay context. Local download consent alone does not suffice. Remove or consistently anonymize private values; do not leave essential context omitted.
4. Select `cohort: "development"` if the case has been used for debugging, parser changes, calibration fitting or repeated tuning. Use `held-out` only for a genuinely withheld case, with `heldOutFromDevelopment: true`. Check semantic duplicates and exposure manually; the automatic check only catches exact normalized prompt/context duplicates. Do not label generated cases as real failures or independent evidence.
5. Admit the reviewed draft:

   ```sh
   npm run feedback:dv13:admit -- .local/dv13/review.json
   npm run benchmark:dv13
   ```

Admission rejects missing review fields, cohort mismatches and duplicate/exposed questions. It writes only reviewed case fields, excluding the observed engine response, and updates the corpus hash. Review the corpus and manifest change together. Do not edit admission files concurrently. No command uploads the report automatically.

## Resolve textual grading

Run `npm run benchmark:dv13`. Inspect `docs/dv13/adjudication-queue.json` and the associated source evidence. A human may copy a queue record to `adjudications.json`, supply `outcome` (`correct-answer` or `incorrect-answer`), reviewer, date and rationale, and set `humanReviewed: true`. Keep the exact case ID and response hash. The tool does not decide that a plausible paraphrase is correct. A changed question, output, plan or bound value makes its previous decision stale and leaves it pending.

The RC gate evaluates held-out rows only. It retains the independent sample/category thresholds, confidence calibration requirement and inherited critical-item gate. Development verification may pass while RC verification correctly fails. Once a held-out failure is used to implement a fix, move it to development and collect fresh held-out evidence; never keep treating it as blind evidence.
