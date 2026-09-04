# 11 — The Spec Layer

**Status: Draft — layering settled, retirement list open**

Praxis v2 is two layers. This document names them, states the contract between them, and lists where v1's structure crossed the line and must be pulled back.

## The two layers

> **Where they live in the code** (updated 2026-09-05; the
> `src/domains/{eval,spec}` layout below was collapsed to layers on
> 2026-09-02). `src/` is organised by *layer* — models, stores,
> services, orchestrators, views, prompts — not by domain, and the
> spec↔eval isolation is a **documented contract rather than a path
> rule**: after the collapse no path means "the eval side", so ESLint
> cannot express the ban. The contract stands unchanged: the compiler
> writes files (profiles carrying `paths:`/`cohort:`/`excludes:`), and
> the eval side consumes them as plain files, never calling back. The
> bridge is `templates/eval-targeting-template.ts` writing `paths:` and
> `services/discover-domains-service.ts` reading it — `ExpertFile` and
> `SpecFile` are the two ends.

**The eval layer** — spec, scope, reviewer, cache, ledger, triage, axioms, calibration, metrics, briefs. This is what v2 _is_. Its input contract with the world is exactly three things:

1. **A spec** — any file carrying direction, identified by `specFilePattern`.
2. **A scope** — the files the spec governs, via `paths:` frontmatter or directory siblinghood.
3. **Stable identity** — content that can be hashed, for cache keys, ledger provenance, and epoch detection.

Nothing in the eval layer knows or asks how a spec came to exist.

**The spec layer** — everything about producing and maintaining specs. This is where the compiler tools live: experts, practices (v1: roles, responsibilities), constitution, conventions, reference, `praxis compile`, SME profiles, `praxis add`. The content taxonomy is a spec-layer authoring convention — one disciplined way to produce a good spec — not an eval-layer concept.

The simplest path through the spec layer is no tooling at all: the thesis (README) is that specs are the developer's _existing_ context files. A team that points `paths:` at its CLAUDE.md is fully participating in the eval. The compiler earns its keep for teams that want more discipline, because bundling an expert's definition + practices + context into an SME profile at compile time is precisely what creates the property the eval rests on — **the reviewer measures adherence to the exact direction the agent was given.** The SME's double duty (`validates:` makes the compiled profile _be_ the spec) is the bridge between the layers, and the only place they touch.

## The rule

**Nothing in the eval layer may depend on the content taxonomy.** No eval data structure, metric, report, or cache key may require that a spec was born from an expert definition, or that documents are experts, practices, conventions, or constitutions. The working instance already demonstrates the taxonomy-free path: one `*.sme.md` spec over `backend/app/events/**/*.rb` — no roles directory in sight from the eval's perspective.

The dependency runs one way: the spec layer produces artifacts the eval layer consumes as plain specs. The eval layer never calls back into the spec layer.

## v1 leaks to retire

Three places where the taxonomy currently crosses into eval machinery:

1. **`DocumentType`** (`role | responsibility | reference | convention | constitution`) is baked into the validator and cache metadata. Wrong-shaped the moment targets are `.rb` files. The eval-layer notion of "type" is the validation domain — which spec covers the file — and the ledger (05) already keys records on spec hashes. The enum retires with the v2 data model.

2. **`praxis status`** mixes two dashboards: eval state (validation coverage, verdict counts — belongs in 09's orientation screen alongside axioms and epochs) and knowledge-framework health (orphaned responsibilities, unmatched owners, missing descriptions). These split. Framework health remains available, but only surfaces when the compiler is in use, and never mingles with eval metrics.

3. **`praxis init`** scaffolds the full taxonomy (constitution/, conventions/, roles/, ...), presenting the authoring pattern as if it were the product. v2's init scaffolds the eval layer (`.praxis/` per 10); the spec-layer scaffold becomes an explicit opt-in.

None of these retirements removes capability. Teams using the compiler keep everything; teams that never adopt the taxonomy stop being asked about it.

## Open questions

1. Does the spec layer stay in the `praxis` binary or become a separable concern (`praxis compile` as the only spec-layer command surface)? Current lean: same binary, separate command namespace — one tool, two layers, per 09's single-surface principle.
2. Where does spec _quality_ tooling belong (e.g., the axiom authoring gate from 03 advising whether direction is reviewable)? It reads like spec-layer tooling but its verdicts guard the eval layer's integrity. Likely: eval layer owns the gate, spec layer calls it.
