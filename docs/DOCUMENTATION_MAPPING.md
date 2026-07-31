# Supplied documentation mapping

The uploaded Lexi documentation describes five fundamental stages. DV7 keeps
those stages as compatibility layers and adds typed semantics, propositions,
proof rules, and session state before them:

| Documentation mechanism | Prototype implementation |
| --- | --- |
| Parse the requested subject and context | `modules/semantic/parser.ts` produces typed subjects, objects, relations, conditions, quantities, time, style, and negation. |
| Store knowledge without one finished answer per wording | `modules/knowledge-graph/data/` records atomic entities and propositions; `modules/proposition/realizer.ts` constructs a reviewed answer from those values. |
| Connect related knowledge mechanically | `modules/knowledge-graph/reasoner.ts` performs direct, inverse, inheritance, transitive-classification, comparison, and derived-location joins with explicit proof steps. |
| Preserve conversational context | `modules/memory/session.ts` stores explicitly supplied personal facts, the last turn, and up to two active subjects only inside the current session. |
| Measure ordinary-question coverage | `modules/benchmark/dv7.ts` runs curated, memory, and graph-reachability cases and classifies parser, routing, content, proposition, and memory failures. |
| Divide prompts using basic English sentence structure | `modules/discourse/segment.ts` and `reference.ts` separate connected requests and resolve only bounded explicit antecedents; `modules/search/tokenize.ts` supplies sentence mode and basic roles. |
| Directly answer common subjects across varied question structures | `modules/extended-pack/linguistic-features.ts`, `dv6-linguistic-features.ts`, `question-frames.ts`, `dv6-question-frames.ts`, and `router.ts` map framing, style, semantic focus, and subject aliases to explicit topic fields. |
| Perform bounded simple reasoning without prediction | `modules/extended-pack/reasoning.ts` contains anchored numeric, sequence, text-measurement, premise-only deduction, and decision-criteria forms with explicit refusal boundaries. |
| Focus on the intended subject without learned attention | `modules/extended-pack/semantic-routing.ts` removes only declared non-subject modifiers before requiring an exact known topic or alias. |
| Supply field-specific technical context | `modules/extended-pack/topics/dv6-technical.ts` provides 100 reviewed semantic records across engineering, data science, biology, medicine, mathematics, business, law, and research. |
| Correspond each word to relevant recorded examples | `modules/search/index.ts` ranks all registered context examples and records matched and expanded terms. |
| Aggregate word contexts to extract a full prompt context | `modules/context/index.ts` aggregates matches by intent and enforces a confidence floor. |
| Fetch relevant answer words using Connect | `modules/connect/index.ts` prepares bounded response slots or dictionary/thesaurus material. |
| Put answer words into prebuilt structures | `modules/structure/patterns.ts` and `modules/structure/index.ts` select and fill declared templates. |

The documentation also warns that a zero-AI program may misunderstand context.
DV7 turns that warning into a contract: an unsupported relation has no graph
answer, low-confidence fallbacks remain explicit, and every accepted graph fact
can reveal both its proposition IDs and its proof path.

The interface quotation is reproduced from the user-supplied documentation,
without rewriting, in `components/lexi/LexiInterface.tsx`.
