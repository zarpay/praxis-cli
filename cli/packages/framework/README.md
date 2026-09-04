# @framework — the machinery a CLI is built from

This package is the **application-agnostic half** of praxis: the render
kit (`Display`, `Logger`, `ReportLine` routing, badges, stats, tables,
`Prompter`), the generic `Orchestrator` signature, and
`prepareOrchestrator` — the commander-to-orchestrator bridge that
derives options, builds a context per dispatch, and applies the one
error policy.

## The separation, precisely

- **The framework imports no application code — ever.** It does not know
  what praxis is. Where it needs something application-specific it takes
  it as a parameter: `prepareOrchestrator` is generic in its context
  type, and the app's `helpers/prepare-orchestrator-helper.ts` binds it
  to `CommandContext`. That helper is the composition root — the single
  place deciding what a praxis command runs against.
- **Its types live here** (`src/types.ts`): `Orchestrator`, `View`,
  `ReportLine`, `DisplayEntry`, `NoOptions`, `CommandRegistrar`.
  Application types (including the app-bound `Orchestrator` and
  `Service` aliases) live in the app's types barrel, which imports from
  here — never the reverse.
- **It is developed as if published separately** (`@framework/*` import
  alias, own test tree at `packages/framework/tests/`). Whether it ever
  ships alone is irrelevant; the discipline is what keeps the boundary
  real.

The test for new code: would this line make sense in a CLI that isn't
praxis? Yes → here. No → `cli/src/`.

Rule: `.claude/rules/framework.md`.
