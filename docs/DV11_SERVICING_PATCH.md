# DV11 servicing patch

This patch does not change the `260812-DV11` development level. It connects
the package and data mechanisms that DV11 already declared.

## Executable request path

An asynchronous browser request now follows one observable sequence:

1. Normalize and segment the input.
2. Produce a typed `Dv11QueryPlan`.
3. Extract candidate aliases, entity IDs, sense IDs, predicates, and domains.
4. POST those candidates and the already installed package IDs to
   `/api/lexi/resources`.
5. Resolve candidates through Worker-side global indexes.
6. Read and validate only the necessary compressed source shard in the Worker.
7. Return a small, versioned `Dv11KnowledgePackage` containing matched records.
8. Validate and install the package atomically through `Dv11PackageRegistry`.
9. Parse again, relink against the updated store, reroute, and execute.
10. Attach claim IDs, source metadata, proof steps, stages, confidence, and live
    store counts to the response trace.

Cancellation propagates through the HTTP request and package installation.
Dialogue mutations remain transactional and commit only after a completed
response.

## Global indexes

`scripts/build-dv11-service-data.mjs` deterministically compiles:

- a normalized alias-to-lexeme/sense/source-shard index
- a stable entity-ID index
- a predicate-to-source-shard index
- a domain-to-predicate/package index
- a sense-ID-to-source-shard index
- unique executable query frames from the 100,000 query examples
- unique executable dialogue transitions from the 40,000 scenarios

The generated catalog reports exact source rows, not construction estimates:

- 160,579 indexed aliases
- 323,853 indexed entity records
- 163,274 indexed sense-to-shard records
- 6 indexed executable lexical predicates
- 10 indexed domains
- 800,000 server-queryable lexical fact rows
- 10 unique compiled query frames representing 100,000 source examples
- 8 unique compiled dialogue frames and transitions representing 40,000 source
  scenarios

The repeated training rows are compiled into their unique deterministic
behaviors. They are not reported as 100,000 runtime parser rules or 40,000
simultaneously loaded dialogue programs.

## Separate lexical and world stores

`Dv11KnowledgeStore` now keeps these world structures separate:

- world entities
- semantic/world senses
- world propositions
- relation schemas

It independently keeps:

- lexemes
- lexical aliases
- lexical senses
- lexical claims for definition, part of speech, usage, association, and source

The lexical service package has zero world entities and zero world
propositions. A spelling match alone therefore cannot convert a dictionary
entry into a factual world claim.

## Memory boundary

The 800,000-row corpus and its global indexes remain static assets accessible
to the Worker. The browser receives only matched packages and maintains bounded
HTTP/package caches. The older DV9 compatibility loader also uses
`/api/lexi/lexical` in a browser, so it no longer imports full alphabet shards
during ordinary use.

The Worker holds at most 12 parsed asset entries per isolate. This includes
catalog/index/source shards and prevents an isolate from accumulating the
entire corpus through ordinary requests.

## Exact counts

Every DV11 reply trace can include `liveKnowledge`, whose fields are computed
directly from the active store:

- `worldEntities`
- `worldAliases`
- `worldPropositions`
- `worldSenses`
- `lexemes`
- `lexicalAliases`
- `lexicalSenses`
- `lexicalClaims`
- `installedPackages`
- `queryableClaims`

`queryableClaims` equals live world propositions plus live lexical claims. It
does not use generated pack totals, semantic-construction estimates, or an
availability multiplier.

## AD package compatibility

Future DV11AD packages use the same manifest and executor contract. A package
must declare schema version 1, minimum runtime DV11, dependencies, content hash,
typed counts, capabilities, and provenance-bearing contents. World packages
may add entities, schemas, propositions, and semantic senses. Lexical packages
may add lexemes, lexical senses, and lexical claims. Both are installed through
the same atomic registry operation, followed by reparse and relinking.

Build and validate the service artifacts with:

```bash
npm run dv11:build-service-data
npm run dv11:validate-service-data
```

The validator checks the sizes and SHA-256 hashes of all cataloged source
shards and indexes, verifies shard totals against catalog totals, and checks the
matched-record-only browser policy.
