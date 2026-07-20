# Linguistic and lexical sources

The first Structure Module deliberately implements only a small, auditable
grammar fragment. These sources inform its terminology and initial categories:

- [Cambridge: Clauses and sentences](https://dictionary.cambridge.org/grammar/british-grammar/sentences-and-clauses) — a clause normally contains a verb and commonly a subject, verb phrase, and optional complement. This supports Lexi's initial clause fields.
- [Cambridge: Clause types](https://dictionary.cambridge.org/us/grammar/british-grammar/clause-types) — the four initial modes are declarative, interrogative, imperative, and exclamative; the page also documents their typical orders.
- [The Science of Syntax: Syntactic categories](https://opentext.ku.edu/syntax/chapter/chapter-2-parts-of-speech/) — motivates representing grammar as explicit descriptive rules and demonstrates why a small grammar fragment must not be presented as complete English.
- [The Science of Syntax: Constituency](https://opentext.ku.edu/syntax/chapter/chapter-3-constituency/) — explains constituent groupings and subject–verb / subject–verb–object abstractions.
- [Wordset dictionary](https://github.com/wordset/wordset-dictionary) — complete vendored dictionary source used to compile runtime definitions.
- [Moby Thesaurus](https://github.com/words/moby) — complete vendored relation source used to compile the runtime synonym graph.

These references do not make the current heuristic parser a full syntactic
parser. The current code recognizes useful surface patterns; deeper constituency,
agreement, tense, complements, coordination, and subordinate clauses remain
explicit future modules.
