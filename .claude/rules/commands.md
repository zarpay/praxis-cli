---
description: What belongs in src/commands — route declarations only
paths:
  - cli/src/commands/**
---

# Commands

**A command is a route.** It declares the command, its arguments and its options,
then hands them to one orchestrator. Nothing else. Nothing imports `commands/`.

- **One file, one `export default function register{Name}Command(program)`.** It
  takes the commander `Program` and registers onto it; `index.ts` is the only
  caller. The same one-per-file default export the services, orchestrators and
  prompts use.
- **One command, one orchestrator, called once.** The action body is a single
  `orchestrator(ctx, options)` call and nothing else. A command imports
  orchestrators and `runAction` — never a model, a service, or a view.
- **The orchestrator owns the whole response, rendering included.** It hands back
  an outcome, not a payload: `"failed"` exits 1, anything else is success. If you
  find yourself doing something with a return value here, it belongs one layer
  down.
- **Options pass through as the user typed them.** Projecting them into what an
  orchestrator needs is the orchestrator's job, not a helper function here. A
  local helper in a command file means work has leaked upward.
- `runAction` (`commands/action.ts`) is the composition root. It builds the
  `CommandContext` at dispatch — never at module load — and applies the one error
  policy: a thrown error logs to stderr and exits 1. Don't hand-roll try/catch
  around an action body, and don't construct a context yourself.
