---
description: What belongs in src/helpers — the reusable modules any service may lean on
paths:
  - cli/src/helpers/**
---

# Helpers

**A helper is a plain reusable module** — named `{name}-helper.ts` — that any
service, model or orchestrator may use. Whether it knows about Praxis does not
matter; what matters is that it sits below every working layer and never
imports one (ESLint-enforced: no services, orchestrators, views, prompts,
providers, plugins or templates).

- `files-helper.ts` and `paths-helper.ts` wrap `node:fs` and `node:path`, and
  are the only two modules allowed to import them. They are deliberately
  namespace modules, not services — splitting them into single-function files
  would trade a wall for scattered one-liners.
- `errors-helper.ts` owns every error Praxis raises: one factory per failure
  mode, carrying a machine-readable code (`PraxisErrorCode` in `src/types.ts`).
  Callers `throw errors.<name>(...)` and never build error strings.
- `text-helper.ts` shapes strings for humans (`kebabToTitleCase`) — never
  parsing, never I/O.
- `prepare-orchestrator-helper.ts` binds the framework's generic
  `prepareOrchestrator` to Praxis's `CommandContext`. It is the composition
  root: the one place that decides what context a command runs against.
- A helper with one caller is not a helper — it stays module-private in its
  caller. This directory is for what is genuinely shared.
