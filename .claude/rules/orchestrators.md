---
description: What belongs in a domain's orchestrators/ directory
paths:
  - cli/src/domains/*/orchestrators/**
---

# Orchestrators

**An orchestrator is a controller.** It does everything needed to return one
command's expected output: interacts with models, and delegates the heavy lifting
to services. A command has a direct relationship to the orchestrators it calls —
if a command is doing work that is not argument parsing or rendering, that work
belongs here.

- **Named `{verb}-{noun}-orchestrator.ts`** for what it produces:
  `run-eval-orchestrator.ts`, `compile-project-orchestrator.ts`,
  `analyze-project-orchestrator.ts`.
- **Its named export is the filename in camelCase** —
  `run-eval-orchestrator.ts` exports `runEvalOrchestrator`. One file, one
  orchestrator: if you want a second prepared form, it needs its own file
  (`ci-run-orchestrator.ts`, `add-expert-orchestrator.ts`), named for the command
  it serves so that command is findable from the filename.
- **`export const nameOrchestrator: Orchestrator<Options> = async (ctx, options) => {}`,
  with `export default prepareOrchestrator(nameOrchestrator)` beneath it.** The default export is
  the wrapped form a command hands to `.action()`; the named export is the
  orchestrator itself, which is what a test calls. `Orchestrator` (`domains/workspace/types.ts`) is the one signature
  every orchestrator has, applied to the const rather than annotating a function
  declaration — that is what makes it enforced rather than described.
- **The `options` parameter is never dropped.** An orchestrator that takes none is
  `Orchestrator` (defaulting to `NoOptions`) and its command passes `{}`. The
  implementation may omit the parameter; the call site may not. `Options` is the
  command's parsed input, typed in the domain's `types.ts`; everything about the
  project — root, paths, config — comes off `ctx`, never a parameter.
- **Always `async`**, so `prepareOrchestrator` has one shape to await _and_ one channel for
  failures. A non-async function returning `Promise.resolve()` throws
  synchronously, which is a second signature in disguise.
- **Returns a `CommandOutcome`, or nothing.** `"failed"` becomes exit 1 — a
  legitimate result like issues found, not an error. Genuinely unusable input is
  thrown instead. It never returns a payload: there is no caller left to consume
  one.
- **A class is fine when several orchestrators share real scope or behaviour** —
  a common constructor payload, a cached handle, helpers they all need. Reach for
  it when the sharing exists, not in advance; one orchestrator alone is a
  function.
- It **sequences services**. It does no scanning, parsing, globbing or rendering
  of its own — if it is doing the work itself, that work is a missing service.
- **Renders its own views**, through `ctx.out` and `ctx.logger`. It is the only
  layer that decides a command has finished and what the user sees for it.
- **Assembling the data it renders belongs in a service.** An orchestrator that
  computes a report and prints it has made that report untestable; push the
  computation down and the orchestrator becomes coordinate → render → signal.
  `build-status-report`, `review-all` and `collect-verdict-reports` are that split.
- Failures that should not abandon the run come back in the result (a skipped
  file, an error verdict); only a genuinely unusable input raises.
