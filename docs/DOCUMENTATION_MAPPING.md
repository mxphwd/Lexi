# Supplied documentation mapping

The uploaded Lexi documentation describes five fundamental stages. DV8 added
typed execution; DV9 adds provenance-bearing lexical scale and explicit senses
without replacing those compatibility layers:

| Documentation mechanism | Prototype implementation |
| --- | --- |
| Parse the requested subject and context | `modules/dv8/parser.ts` produces executable plans with entities, senses, variables, triple patterns, filters, conditions, quantifiers, time, style, and negation. |
| Store knowledge without one finished answer per wording | `modules/knowledge-graph/data/` records atomic entities and propositions; `modules/proposition/realizer.ts` constructs a reviewed answer from those values. |
| Connect related knowledge mechanically | `modules/dv8/executor.ts` performs forward/inverse joins, filters, aggregates, comparison, inheritance, transitivity, negation, quantifiers, condition checks, and temporal checks with explicit proof steps. |
| Preserve conversational context | `modules/memory/session.ts` stores personal facts, while `modules/dv8/dialogue.ts` stores answer propositions, subjects, proof, and conversational goals only inside the current session. |
| Measure ordinary-question coverage | `modules/benchmark/dv8.ts` reports knowledge, language, reasoning, dialogue, precision, and latency against 4,124 stateless cases and 120 dialogue sessions. |
| Scale lexical facts without answer duplication | `scripts/build-dv9-data-pack.mjs` compiles lemma and sense entities, atomic facts, typed relation profiles, plan examples, rules, dialogue scenarios, and an isolated evaluation pack. |
| Preserve source and uncertainty | `modules/dv9/types.ts` and `schema.ts` retain source identity, evidence locators, confidence, review status, validity intervals, and dispute links. |
| Resolve long-tail word senses | `modules/dv9/parser.ts`, `loader.ts`, and `realizer.ts` load one lexical shard and select an explicit sense from contextual evidence. |
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
DV8 and DV9 turn that warning into an execution contract: an unsupported relation has
no fact path, subject-incompatible fallback is blocked, ambiguity remains an
explicit set of senses, and every accepted fact reveals its IDs and proof path.

The interface quotation is reproduced from the user-supplied documentation,
without rewriting, in `components/lexi/LexiInterface.tsx`.
