# Supplied documentation mapping

The uploaded Lexi documentation describes five fundamental stages. This
prototype maps each one to a concrete boundary:

| Documentation mechanism | Prototype implementation |
| --- | --- |
| Divide prompts using basic English sentence structure | `modules/discourse/segment.ts` and `reference.ts` separate connected requests and resolve only bounded explicit antecedents; `modules/search/tokenize.ts` supplies sentence mode and basic roles. |
| Directly answer common subjects across varied question structures | `modules/extended-pack/linguistic-features.ts`, `question-frames.ts`, and `router.ts` map framing, style, semantic focus, and subject aliases to explicit topic fields. |
| Correspond each word to relevant recorded examples | `modules/search/index.ts` ranks all registered context examples and records matched and expanded terms. |
| Aggregate word contexts to extract a full prompt context | `modules/context/index.ts` aggregates matches by intent and enforces a confidence floor. |
| Fetch relevant answer words using Connect | `modules/connect/index.ts` prepares bounded response slots or dictionary/thesaurus material. |
| Put answer words into prebuilt structures | `modules/structure/patterns.ts` and `modules/structure/index.ts` select and fill declared templates. |

The documentation also warns that a zero-AI program may misunderstand context.
The prototype turns that warning into behavior: low-confidence prompts receive a
safe, explicit fallback, and every accepted answer can reveal its match trace.

The interface quotation is reproduced from the user-supplied documentation,
without rewriting, in `components/lexi/LexiInterface.tsx`.
