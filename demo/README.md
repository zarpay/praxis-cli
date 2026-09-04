# Scoop Society

An ice cream parlor review API — and the **Praxis end-to-end demo**.
The app is deliberately small and deliberately conventional: its
conventions exist so Praxis has real standards to compile, review, and
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
conventions (`src/features/README.md`) reviewed **per directory** via
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
`cohort: by_directory`, so it reviews each feature as one unit. Compile
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
reviews all of a feature's files together — the shape for standards like
"no orphaned files" that no single file can answer. Review them:

```bash
npx praxis status              # offline: counts, coverage, cached verdicts
npx praxis eval run            # reviews every spec-covered target (needs OPENROUTER_API_KEY)
npx praxis eval verdict src/services/create-review.ts
```

Verdicts are cached under `.praxis/cache/` and committed, so a reviewed
state is shared: re-runs are free until a file or its spec changes.

## Why the conventions are shaped this way

They're chosen to exercise Praxis's review boundary: some criteria
are mechanical (one exported `run` — a linter could check it) but most
turn on meaning — "error messages are written for the API consumer,"
"services do one thing." Those are the standards only a review can
evaluate, which is exactly Praxis's territory.

## What this demo has proven

First reviewed run 2026-08-31 (`deepseek/deepseek-v4-flash-0731`); the
committed cache under `.praxis/cache/` is that run's shared evidence:

- **The full loop, live**: real findings → fixes → automatic cache
  invalidation → re-reviewed to green (8/8 compliant at steady state).
- **Cohort review**: the tasting-menu directory's first verdict
  caught a genuine relational violation (types-file naming) across a
  three-file set — a finding no per-file review could produce.
- **All three invalidation classes**: editing a target, editing a
  cohort member, and editing a spec each invalidated exactly what they
  should — one file, one directory, every target of that spec.
- **Reviewer noise resolves at the spec**: one warning flagged behavior
  the spec permitted (its own reasoning said so); the fix was
  sharpening `tests/README.md`, after which all four suites re-reviewed
  clean. The spec is part of the instrument.

## Custom review provider

`praxis-providers/word-count.js` is a local review provider — the
`counter` review in `.praxis/config.json` runs through it instead of
OpenRouter, proving reviewers are endpoint-agnostic: any module whose
default export returns `{ name, review(request) }` (normalized verdict +
usage) can review. It makes no network calls at all.

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
  never reviewed
- `src/services/_wip-refund.ts`, `knowledge/experts/_expert-template.md`
  — underscore-prefixed: never reviewed, never compiled
- `src/generated/` — covered by the config's `ignore:` patterns

Do not "fix" these files; the eval layer's output depends on them.

## The testbed discipline

This demo is the CLI's live acceptance environment — treat its state as
evidence, not fixtures:

- **The committed cache and ledger are real reviewed evidence.** Never
  regenerate them casually; edits invalidate selectively by design, and
  new run files are committed like code (spec 10-k).
- **The canary**: `npx praxis eval run --reviewer counter` (the offline
  word-count provider) must always be all cache hits. A miss means
  reviewer identity changed — an epoch event that must be deliberate.
- **The full acceptance matrix lives in [`EXPECTATIONS.md`](./EXPECTATIONS.md)**,
  run by the `demo-audit` skill after every feature. Update the matrix
  in the same commit as any behavior or state it describes.
- Real reviews need `OPENROUTER_API_KEY`. Reviewers: `flash`
  (deepseek-v4-flash — cheap; known to intermittently emit invalid
  tool-call JSON when critique text echoes quoted strings, which
  correctly yields UNVERIFIED), `v32` (deepseek-v3.2 — sturdier), and
  `counter` (offline, free, the canary). Curator: claude-sonnet-4.5.
- Curator-spending or queue-consuming commands (`axioms triage`,
  `ratify`, `audit`) run against a scratch copy, never the real demo.
