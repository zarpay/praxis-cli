---
description: What belongs in packages/framework — the CLI machinery, built as if published
paths:
  - cli/packages/framework/**
---

# Framework

**The framework is "like" a separate npm package.** It is the machinery a
CLI is built from — how an orchestrator becomes a commander action, what a
display entry is, the render kit — and it is developed as if it shipped
independently: `@framework/*` is its alias, and it must not import
application code at all (ESLint-enforced: no `@/*`).

- `types.ts` holds its vocabulary: display entries, `ReportLine`,
  `CommandRegistrar`, `CommandOutcome`, and the generic
  `Orchestrator<Ctx, Options>`. Praxis's own vocabulary lives in
  `src/types.ts`.
- `prepare-orchestrator.ts` is generic in its context and takes a factory;
  the application binds it in `src/helpers/prepare-orchestrator-helper.ts`
  by supplying `() => new CommandContext()`. That binding is the one place
  the machinery meets the application.
- `views/` is the render kit: `Display` (stdout), `Logger` (stderr), and
  the badge/stat/table/report helpers. `display.ts` and `logger.ts` are
  the only two files in the repo allowed to call `console.*`.
- Where the framework needs something application-specific, it takes it as
  a parameter rather than importing it.
