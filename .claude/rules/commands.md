---
description: What belongs in src/commands — route declarations only
paths:
  - cli/src/commands/**
---

# Commands

**A command is a route.** It declares the command, its arguments and its options;
parses what the user typed; calls an orchestrator; renders the result through the
domain's views; and maps it to an exit code. Nothing else. Nothing imports
`commands/`.

- **Every command has one or more dedicated orchestrators.** Logic that is not
  argument parsing or rendering belongs to one of them. If you are reaching for a
  model or a service directly from here, an orchestrator is missing.
- Rendering happens here because printing is the route's job — but *what* to show
  is decided by a view that returns entries, never assembled inline.
- Error policy is `runAction` (`commands/action.ts`): a thrown error logs to
  stderr and exits 1, a returned number is the exit code, returning nothing lets
  the process exit naturally. Don't hand-roll try/catch around an action body.
- `new Paths()` and anything else touching cwd is constructed at action dispatch,
  never at module load.
