---
description: What belongs in src/commands — route declarations only
paths:
  - cli/src/commands/**
---

# Commands

**A command is a route.** It declares the command, its arguments and its options,
then hands them to one orchestrator. Nothing else. Nothing imports `commands/`.

- **One file, one `const register{Name}Command: CommandRegistrar`, default
  exported.** `CommandRegistrar` (`src/types.ts`) is the one signature every
  command file has, applied to the const rather than annotating a function
  declaration — that is what makes it enforced rather than described, the same
  way `Orchestrator` is one layer down. Keep the name on the const: an anonymous
  default export loses it in stack traces. `index.ts` is the only caller.
- **Prepare the orchestrator into a const at module top, then name it in the
  action:**

  ```ts
  const orchestrator = prepareAction(analyzeProject);
  // …
  .action(orchestrator);
  ```

  There is no lambda anywhere: both sides have a fixed shape, so
  `prepareAction` derives the options from commander's own argument names and
  parsed flags. A command imports orchestrators and `prepareAction` — never a
  model, a service, or a view.

- **A group declares one const per subcommand, named for it** — `show`/`edit`,
  `expert`/`practice`, `run`/`ci`/`verdict` — since `orchestrator` can only name
  one. Preparing is a definition, not work, so module top is the right place;
  the context is built inside the returned handler, per dispatch.
- **A command's flags and arguments _are_ its orchestrator's `Options`.** Name
  them to match — `<target> --verbose` yields `{ target, verbose }` — and the
  wiring writes itself. This half is not type-checked, so a rename on one side
  only is caught by the tests and the demo run, not the compiler.
- **`prepareAction(orchestrator, extra)`** supplies only what the CLI surface cannot: a
  literal separating two commands that share one orchestrator, like
  `{ type: "expert" }` or `{ ci: true }`. `extra` _is_ type-checked.
- **The orchestrator owns the whole response, rendering included.** It hands back
  an outcome, not a payload: `"failed"` exits 1, anything else is success. If you
  find yourself doing something with a return value here, it belongs one layer
  down.
- `prepareAction` (`commands/action.ts`) is the composition root, and it _returns_
  the handler rather than being called inside one. Preparing is a definition, so
  it belongs at module top; the `CommandContext` is built inside the returned
  handler, per dispatch and never at module load. The one error policy lives
  there too: a thrown error logs to stderr and exits 1. Don't hand-roll try/catch
  around an action, and don't construct a context yourself.
