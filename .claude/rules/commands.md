---
description: What belongs in src/commands — CLI wiring only
paths:
  - cli/src/commands/**
---

# Commands

Commands are **wiring**: parse arguments, build the input payload from config,
call one orchestrator, render what comes back, map the result to an exit code.
Nothing imports `commands/`.

- Business logic belongs in a domain. If a command is scanning, parsing or
  deciding, that work is a missing service or orchestrator.
- Rendering happens here, through the domain's views — a command subscribes to an
  orchestrator's `onProgress` events and prints them.
- Error policy is `runAction` (`commands/action.ts`): a thrown error logs to
  stderr and exits 1, a returned number is the exit code, returning nothing lets
  the process exit naturally. Don't hand-roll try/catch around an action body.
- `new Paths()` and anything else touching cwd is constructed at action dispatch,
  never at module load.
