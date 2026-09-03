---
description: What belongs in src/stores — one file-backed subsystem's handle each
paths:
  - cli/src/stores/**
---

# Stores

**A store is one file-backed subsystem's handle**: its layout, its id
minting, its reads, writes, and moves — the IO half of a model family.
`VerdictStore` owns the verdict cache, `Ledger` the append-only evidence,
`AxiomStore` the axiom lifecycle, `ExpertStore`/`PracticeStore` their
document directories. Every model with a file backing gets its store here;
IO for a file kind scattered across services is the smell this directory
exists to end.

- **Named `{name}-store.ts`** (`ledger.ts` is grandfathered — it _is_ the
  store), exporting the filename in PascalCase as a class. Constructed per
  use from a `projectRoot` (or the specific directory), never held as a
  singleton.
- **Layered between models and services**: a store imports helpers,
  templates, and models — never services, prompts, orchestrators, or views
  (ESLint-enforced). Services construct stores and call their methods; a
  service whose whole body is one verb against one store's own contents is
  a method wearing a service's filename.
- **The store owns its policy, and states it**: the verdict cache fails
  soft in both directions and its two read paths carry different corruption
  policy; the ledger's reads never raise and its writes always do. Policy
  that depends on _caller context beyond the store's own contract_ — what a
  failed write means to a whole run, cross-store workflows, record assembly
  from external facts (git, LLM calls) — stays in services.
- **The document format stays a model.** `CacheFile` is the format,
  `VerdictStore` the IO; `AxiomFile` the document, `AxiomStore` the
  directory. A store parses _into_ models and serializes _from_ them —
  `readText(path)` then `Model.fromContent(content, path)`; models have no
  `at()` because reading disk is this layer's job.
- **Sweeps report, never raise**: `all()` returns `{items, problems}` —
  one malformed file is a `StoreProblem`, not a dead sweep. Sweep listing
  rules (spec files excluded, `_`-prefixed templates excluded, ignore
  patterns honored) live once, in the store.
- Tests mirror to `tests/stores/`, exercising public methods on real
  tmpdirs — the store _is_ the IO boundary, so nothing about it is mocked.
