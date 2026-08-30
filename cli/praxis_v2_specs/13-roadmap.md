# 13 — Roadmap: Sequencing and the MVP

**Status: Draft — ordering settled (spec layer → eval layer, critiques → axioms), milestone contents open to adjustment**

The other documents describe an end state. This one says what gets built in what order, and why the order is spec layer first, then the eval layer from the critique flow outward — each milestone leaving a tool that is useful on its own.

## The dependency spine

Everything measured depends on critiques being durable; everything aggregated depends on axioms having identity; everything trusted depends on provenance being complete. So: **ledger before taxonomy, taxonomy before metrics, metrics before feedback.** Git integration (12) slots in only when flow metrics need it — the corpus-level loop proves the thesis without it.

## Milestones

**M1 — Spec layer settled** *(largely shipped in v1's terminology migration)*
Expert/practice compiler, spec targeting via `paths:`, the `eval` CLI family, judge naming. Remaining from [11](./11-spec-layer.md)'s retirement list: `praxis init` scaffolds the eval-layer `.praxis/` tree with the spec-layer scaffold as explicit opt-in; `praxis status` splits eval state from framework health; `TargetType` retires from eval-layer data. Plus the spec scoping frontmatter (03) — `excludes`, `exemplars`, and the pre-axiom scope defaults `cohort`/`context` — authored on specs and experts and compiled through to SME profiles; the eval layer honors them as M2 lands the cache changes they key into (context-in-key, cohort hash — both already required by 05).

**M2 — Critique flow** *(first eval-layer milestone; with M3, the MVP)*
Critiques become durable records. The ledger (05): run + critique records, full provenance, OpenRouter `usage` captured (cost data exists for the first time). Cache format changes: judge-hash namespacing, context-in-key. Judge output becomes structured critiques ready for the two channels. Corpus-level only — no git, no axioms yet. *Standalone value: durable evidence and cost visibility on any v1 project, immediately.*

**M3 — Axiom flow** *(completes the MVP)*
The taxonomy machinery: `axioms triage` as the human-in-the-loop review session (04), `proposed/` + `ratify` with spec traceability, the authoring gate (03), the two-channel judge (checklist + open channel), residual tracking. The fast loop starts returning axioms instead of raw prose. *Standalone value: the 223 zarpay critiques become a ratified taxonomy; agents get stable, teachable feedback.*

**The MVP is M2 + M3.** The scope is novel but not extensive: one new store (ledger), one new record shape (critique), one new interactive surface (triage/ratify), one judge-prompt change (two channels). It proves the core thesis — SME critiques are qualitative data that normalize into a longitudinal taxonomy — with zero git machinery.

**M4 — Measurement**
Populations from spec/axiom birthdates, epochs derived from provenance, the debt baseline and paydown surfaces, `eval report` / `debt report` with the hard rules (07): coverage+conformance paired, denominators shown, small-n floors, per-axiom rates. Corpus and per-axiom — still no diffs.

**M5 — Diff units** *(git integration, [12](./12-git-integration.md))*
Merge-base diffs, verdict diffing, violation flow, introduction rate — the agentic development eval proper. This is where "the eval" in the thesis becomes a number.

**M6 — Judge instrumentation**
Calibration cases, `calibrate run|status`, interpretability gating on reports, drift protocol, multi-judge config with inter-judge agreement (06). Ordered after M5 deliberately: calibration gates the *interpretation* of numbers M4–M5 produce, and needs adjudicated cases that accumulate from M2–M3's resolution workflows.

**M7 — Feedback surfaces**
Briefs with triangulated diagnosis, `harness suggest` + the generated drafting command, intervention tracking (08).

## Deferred — in the schema, not the build

`mode: agentic` (03), `cohort` and `changeset` scopes (start with `file` and `file+context`), the `watch` trigger (12), attribution conventions / the human-agent contrast (02's optional sharpening), A/B interventions (08), multi-repo anything (README non-goal). Each is already shaped in its document; deferral means no code, not no design.

## Migration (v1 → M2)

- Existing cache files move under their computed judge-hash namespace on first v2 run (mechanical: current config *is* the judge).
- Ledger backfill from cache hits on the first ledger-enabled run, marked `backfilled: true` (05's open question — resolved: yes).
- No spec, config, or workflow changes required of users beyond what the terminology migration already aliased.
