# Lexi example-context pages

This directory is Lexi's teaching path. Add new English context pages here and
then register them in `catalog.ts`. Each file is plain JSON using schema version
1; copy any numbered file as a starting point.

Every entry must include:

- `id`: globally unique and stable, such as `weather-basics-001`
- `intent`: the context label shared by paraphrases that expect similar replies
- `input`: one realistic user sentence
- `response`: a factual, bounded answer that Lexi is allowed to reuse
- `keywords`: important normalized terms, without punctuation
- `mode`: `declarative`, `interrogative`, `imperative`, or `exclamative`
- `context.domain`, `context.purpose`, and `context.tone`
- optional `slots`: reusable `subject`, `action`, `object`, and `qualifier`

Writing rules:

1. Put one domain or conversational purpose in each page.
2. Supply at least 15 substantially different phrasings for an intent.
3. Keep answers self-contained; never assume facts that are not present in the
   page or an attributed lexicon.
4. Use a new intent only when the answer behavior is genuinely different.
5. Include confusing near-neighbours as separate examples so the Context Module
   can learn the boundary.
6. Run `npm run corpus:validate` before committing new pages.

The prototype ships with 12 pages and 180 input-response examples (360 paired
sentences). Millions of sentences are a future corpus goal, not a property of
this initial build.
