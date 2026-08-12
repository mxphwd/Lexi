# DV11AD1 ordinary-knowledge extension

DV11AD1 is the first additional-data extension for the DV11 typed runtime. It
adds ordinary world knowledge without adding a competing parser, executor, or
answer-template route.

## Exact published counts

| Surface | Live count |
| --- | ---: |
| Queryable source-attested propositions | 719,949 |
| Unique world entities | 506,655 |
| Indexed normalized aliases | 1,528,693 |
| Typed predicates | 199 |
| Independently loadable logical packages | 10 |
| Physical package shards | 2,302 |
| Compiled relation-language mappings | 29,640 |
| Compiled dialogue scenarios | 5,000 |
| Executable dialogue behaviors | 6 |
| Unique reusable rule bindings | 13 |

The proposition total is read from the generated catalog and verified against
the contents of every package. It is not a theoretical construction total.
The user-visible live store reports only packages actually installed for the
current session; the Worker reports the full server-queryable catalog count as
a separate metric.

## Package boundaries

| Logical package | Propositions | Physical shards |
| --- | ---: | ---: |
| Everyday core | 248,465 | 256 |
| Geography | 119,997 | 256 |
| Natural science | 80,000 | 256 |
| Math and measurement | 1,500 | 253 |
| Computing | 25,000 | 256 |
| History and civics | 109,992 | 256 |
| Processes | 19,997 | 256 |
| Causal explanations | 15,000 | 256 |
| Language mappings | 99,998 | 256 |
| Dialogue behavior | 0 | 1 |

Each logical package is independently addressable. Large knowledge domains are
physically divided by a stable subject hash. The Worker scores candidate shards
using entity, relation, domain, answer-shape, and evidence compatibility, then
returns at most four matched world shards per request. Large indexes and
unmatched propositions remain on the Worker/server side.

## Typed contents

Each world package may contain:

- world entities and their aliases
- typed propositions with entity-reference values
- predicate schemas for non-core Wikidata properties
- relation aliases compiled into parser frames
- reusable rule bindings for inverse, transitive, containment, membership,
  inheritance, and causal-chain behavior
- package capabilities, counts, content hash, runtime compatibility, and build
  date

Lexical senses remain in the separate DV9 lexical store. AD1 aliases resolve to
world entities and never become dictionary senses merely because they share a
spelling.

Every proposition records its source identifier and location, extraction
method, review status, confidence, creation date, license, and dispute status.
AD1 records are marked `source-attested`, not independently reviewed.

## Source and license

The compiler uses the English alias and raw knowledge-graph files published by
the Wikidata5M project, derived from Wikidata. The checked-in source manifest
pins both downloaded archives by SHA-256. Wikidata structured data is available
under CC0; the generated propositions preserve that license declaration.

Raw source archives are not checked into the repository. They are fetched into
the ignored `.cache/dv11-ad1-source/` directory or provided through the
`LEXI_AD1_*` path variables.

## Build and validation

```bash
npm run dv11ad1:fetch-source
npm run dv11ad1:build
npm run dv11ad1:validate
```

Validation fails on a source-hash mismatch, package-hash mismatch, duplicate or
missing proposition ID, duplicate proposition content, missing entity,
unsupported predicate, count drift, absent provenance, index mismatch,
insufficient package division, or a proposition total outside the requested
600,000–800,000 range.

The runtime integration test sends an ordinary question through the Worker,
loads only compatible AD1 shards, reparses against the installed entities,
executes an inverse relation, and requires an answer whose proof contains AD1
proposition IDs.

## Measurement boundary

DV11AD1 expands knowledge recall and parser vocabulary. It does not establish a
50–60% ordinary-question answer rate by itself. No availability or improvement
multiplier is published until the same frozen, independently reviewed ordinary-
question benchmark is run before and after the extension with correct answers,
abstentions, clarifications, partial answers, and errors reported separately.
