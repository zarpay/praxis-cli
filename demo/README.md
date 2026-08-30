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
# GET  http://localhost:3100/parlors   — parlors ranked by rating
# POST http://localhost:3100/reviews   — { parlorId, author, rating, tastingNotes }
```

Behavior lives in `src/services/` under documented conventions
(`src/services/README.md`): one `run` per module, Results over
exceptions, error messages written for the API consumer.

## How it dogfoods Praxis

This project uses the development CLI (`file:../cli` — build it first
with `cd ../cli && npm run build`). It exercises both layers:

**Spec layer** — `knowledge/` holds an expert (`service-steward.md`)
with a practice and a convention. Compile it:

```bash
npx praxis compile
# → agent-profiles/scooper.md          (pure SME profile, paths: frontmatter)
# → plugins/praxis/agents/scooper.md   (Claude Code agent)
```

**Eval layer** — `src/services/README.md` is a spec with `paths:`
frontmatter targeting the service files. Judge them:

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
