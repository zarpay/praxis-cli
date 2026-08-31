# Scoop Society

An ice cream parlor review API — and the **Praxis end-to-end demo**.
The app is deliberately small and deliberately conventional: its
conventions exist so Praxis has real standards to compile, judge, and
report on while the CLI is being developed.

## The app

A dependency-free JSON API over an in-memory store:

```bash
npm install
npm run dev
# GET  http://localhost:3100/parlors       — parlors ranked by rating
# GET  http://localhost:3100/tasting-menu  — a curated three-stop flavor tour
# GET  http://localhost:3100/awards        — Golden Cone and People's Choice
# POST http://localhost:3100/reviews       — { parlorId, author, rating, tastingNotes }
```

Behavior lives in `src/services/` under documented conventions
(`src/services/README.md`): one `run` per module, Results over
exceptions, error messages written for the API consumer. Capabilities
compose in `src/features/` — one directory per feature (`tasting-menu`,
`awards`), each with a single `index.ts` entry point, under relational
conventions (`src/features/README.md`) judged **per directory** via
`cohort: by_directory`: one entry point, no orphaned files, one
capability. Tests live in `tests/` under their own conventions
(`tests/README.md`): subject-framed describes, one assertion per block,
functionality over implementation.

```bash
npm test
```

## How it dogfoods Praxis

This project uses the development CLI (`file:../cli` — build it first
with `cd ../cli && npm run build`). It exercises both layers:

**Spec layer** — `knowledge/` holds three experts, each with a practice
and a convention: `service-steward.md` (Scooper) over the services,
`test-steward.md` (Taster) over the tests, and `feature-steward.md`
(Sundae) over the feature directories — Sundae declares
`cohort: by_directory`, so it judges each feature as one unit. Compile
them:

```bash
npx praxis compile
# → agent-profiles/scooper.md, taster.md   (pure SME profiles, paths: frontmatter)
# → plugins/praxis/agents/                  (Claude Code agents)
```

**Eval layer** — `src/services/README.md`, `tests/README.md`, and
`src/features/README.md` are specs with `paths:` frontmatter. The
features spec adds `cohort: by_directory`: `praxis status` counts each
feature directory as a single evaluation unit, and `praxis eval run`
judges all of a feature's files together — the shape for standards like
"no orphaned files" that no single file can answer. Judge them:

```bash
npx praxis status              # offline: counts, coverage, cached verdicts
npx praxis eval run            # judges every spec-covered target (needs OPENROUTER_API_KEY)
npx praxis eval verdict src/services/create-review.ts
```

Verdicts are cached under `.praxis/cache/` and committed, so a judged
state is shared: re-runs are free until a file or its spec changes.

## Why the conventions are shaped this way

They're chosen to exercise Praxis's judgment boundary: some criteria
are mechanical (one exported `run` — a linter could check it) but most
turn on meaning — "error messages are written for the API consumer,"
"services do one thing." Those are the standards only a judge can
evaluate, which is exactly Praxis's territory.

## What this demo has proven

First judged run 2026-08-31 (`deepseek/deepseek-v4-flash-0731`); the
committed cache under `.praxis/cache/` is that run's shared evidence:

- **The full loop, live**: real findings → fixes → automatic cache
  invalidation → re-judged to green (8/8 compliant at steady state).
- **Cohort judgment**: the tasting-menu directory's first verdict
  caught a genuine relational violation (types-file naming) across a
  three-file set — a finding no per-file judgment could produce.
- **All three invalidation classes**: editing a target, editing a
  cohort member, and editing a spec each invalidated exactly what they
  should — one file, one directory, every target of that spec.
- **Judge noise resolves at the spec**: one warning flagged behavior
  the spec permitted (its own reasoning said so); the fix was
  sharpening `tests/README.md`, after which all four suites re-judged
  clean. The spec is part of the instrument.

## Deliberately non-compliant content

Some of this repo is wrong on purpose — it exists so Praxis has real
FAILs and WARNs to report, and real shields to prove:

- `src/features/loyalty/` — no `index.ts`, orphaned file, two unrelated
  capabilities (cohort FAIL)
- `src/services/apply-discount.ts` — throws for domain failures, vague
  errors, console I/O (FAIL)
- `tests/discounts.test.ts` — vague framing, many assertions per block,
  tests implementation (flagged)
- `src/services/legacy-import.ts` — awful, but `excludes:`-shielded:
  never judged
- `src/services/_wip-refund.ts`, `knowledge/experts/_expert-template.md`
  — underscore-prefixed: never judged, never compiled
- `src/generated/` — covered by the config's `ignore:` patterns

Do not "fix" these files; the eval layer's output depends on them.
