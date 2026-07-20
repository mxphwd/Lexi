# Lexi basic phrases

This independent core layer handles small, foundational exchanges before the Search, Context, Connect, and Structure modules run. It is intentionally narrow, deterministic, and state-free.

Phrase families live in `catalog.ts`. Each family contains:

- a stable `id` and `intent`;
- one or more fully anchored regular-expression patterns;
- one fixed response;
- trace evidence and a sentence mode.

Inputs are normalized in `normalize.ts`, including common English contractions and punctuation. Patterns must match the complete normalized message (`^...$`) so a basic phrase cannot accidentally capture a longer, unrelated request.

Add a regression test for every new phrase family. Do not place factual knowledge, live information, or broad question-answer material here; those belong in context pages or other explicit knowledge systems.

The layer does not retain conversation memory. For example, “What’s my name?” produces an honest memory-boundary response instead of inventing a name.
