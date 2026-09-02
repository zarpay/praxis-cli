---
description: What belongs in src/commands — route declarations only
paths:
  - cli/src/commands/**
---

# Commands

**A command is a route.** It declares the command, its arguments and its options,
then hands them to one orchestrator. Nothing else. Nothing imports `commands/`.

- **Named `{name}-command.ts`, exporting a `const {name}Command: CommandRegistrar`
  as its default.** The filename carries the type and the const carries the
  filename, so `status-command.ts` declares `statusCommand`. `CommandRegistrar` (`src/types.ts`) is the one signature every command file has, applied to the const rather than annotating a function
  declaration — that is what makes it enforced rather than described, the same
  way `Orchestrator` is one layer down. Keep the name on the const: an anonymous
  default export loses it in stack traces. `index.ts` is the only caller.
- **Import the orchestrator and hand it straight to `.action()`:**

  ```ts
  import analyzeProject from "@/orchestrators/analyze-project-orchestrator.js";
  // …
  .action(analyzeProject);
  ```

  An orchestrator exports itself already wrapped, so there is nothing to prepare,
  adapt or close over here. There is no lambda anywhere: both sides have a fixed
  shape, so `prepareOrchestrator` derives the options from commander's own
  argument names and parsed flags. A command file imports orchestrators and
  nothing else — no model, no service, no view, no helper.

- **A command's flags and arguments _are_ its orchestrator's `Options`.** Name
  them to match — `<target> --verbose` yields `{ target, verbose }` — and the
  wiring writes itself. This half is not type-checked, so a rename on one side
  only is caught by the tests and the demo run, not the compiler.
- **Where two commands share one orchestrator**, the orchestrator's own file
  exports the prepared variants — `ciRun`, `addExpert`, `addPractice` — because
  the literal that separates them (`{ ci: true }`, `{ type: "expert" }`) is
  product knowledge, not routing.
- **The orchestrator owns the whole response, rendering included.** It hands back
  an outcome, not a payload: `"failed"` exits 1, anything else is success. If you
  find yourself doing something with a return value here, it belongs one layer
  down.
- `prepareOrchestrator` (`helpers/prepare-orchestrator-helper.ts`) is the
  composition root, and it lives at framework level so an orchestrator can wrap
  itself. Nothing in `commands/` calls it. It builds the `CommandContext` inside
  the returned handler — per dispatch, never at module load — and carries the one
  error policy: a thrown error logs to stderr and exits 1.
