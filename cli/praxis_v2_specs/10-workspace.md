# 10 — The Workspace

**Status:** Draft
**Depends on:** [04](./04-axioms.md), [05](./05-ledger.md), [06](./06-calibration.md); complements [09](./09-cli-surface.md)

## The position

**Everything Praxis owns — axioms, runs, cache, calibration, config — lives under `.praxis/`. None of it bleeds into the project repo.**

The repo belongs to the developer. Specs are their existing context files (READMEs, CLAUDE.md, AGENTS.md — vocabulary), which Praxis _reads and never writes_. Compiled outputs (profiles, plugin files) are out of scope here — the developer configures where those go and can point them anywhere. This document is about Praxis's _state_, and its home has a closed top level:

```
.praxis/
├── config.json          # human-owned    · committed
├── axioms/              # human-ratified · committed
│   ├── AX-0001.md       #   one file per active/deprecated axiom
│   └── proposed/        #   awaiting ratification (triage output)
├── calibration/         # human-adjudicated · committed
│   └── cases/<id>/      #   input + spec ref + expected.json
├── cache/               # machine-owned  · committed (regenerable; shared to save API calls)
│   └── validation/…     #   one file per target; verdicts keyed by (spec, reviewer)
└── ledger/              # machine-owned  · committed (append-only evidence)
    └── runs/<run_id>.jsonl
```

**Adding a top-level entry to `.praxis/` is a design event**, not an implementation convenience. Five entries; each subsystem gets exactly one home; anything that doesn't clearly belong to one of them doesn't get written.

## Ownership split

Two classes of content, and the distinction is enforced, not stylistic:

- **Human-owned / human-ratified** — `config.json`, `axioms/`, `calibration/`. Markdown and JSON meant to be read, edited, and reviewed in PRs. Praxis writes here only through explicit verbs (`triage` writes proposals, `ratify` moves them) and never rewrites what a human authored.
- **Machine-owned** — `cache/`, `ledger/`. Never hand-edited: cache entries are reproducible artifacts of `(inputs, reviewer)`, and ledger records carry provenance that hand-editing would falsify. Praxis treats unexpected content here as corruption (v1 already deletes corrupt cache files on read), not as input.

## Commit policy

Everything under `.praxis/` is committed, including the machine-owned dirs:

- **cache/** — regenerable, but committing it shares verdicts across the team and CI: one person's validation run is everyone's cache hit. (zarpay/core already does this.) One file per target holds all reviewers' verdicts, keyed by (spec, reviewer) hashes (05); dead reviewers' keys are prunable.
- **ledger/** — the evidence itself; committing it _is_ the durability story. One file per run keeps merges conflict-free (05).
- No `.gitignore` inside `.praxis/`. If something shouldn't be committed, it shouldn't be written there.

## Open questions

1. Ledger growth: at what size does `ledger/runs/` need year/month partitioning (`runs/2026/…`)? Cheap to add later; the run-file format doesn't change.
2. Should `praxis init` scaffold the full `.praxis/` tree upfront (empty dirs communicate the shape) or lazily on first use (no empty noise)? Leaning lazy — the closed set is documented, not performed.
