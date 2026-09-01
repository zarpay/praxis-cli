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

- Named `{verb}-{noun}` for what it produces: `run-eval.ts`, `compile-experts.ts`,
  `analyze-project.ts`, `report-verdicts.ts`.
- Default-export a function taking one named input payload and returning one named
  result type, both declared in the domain's `types.ts`.
- **A class is fine when several orchestrators share real scope or behaviour** —
  a common constructor payload, a cached handle, helpers they all need. Reach for
  it when the sharing exists, not in advance; one orchestrator alone is a
  function.
- It **sequences services**. It does no scanning, parsing, globbing or rendering
  of its own — if it is doing the work itself, that work is a missing service.
- **Never prints.** Streamed output goes through an optional `onProgress`
  callback emitting typed events; the command renders them. That keeps long runs
  reporting as they go while the orchestrator holds no output stream, and lets a
  test collect the events as data.
- Failures that should not abandon the run come back in the result (a skipped
  file, an error verdict); only a genuinely unusable input raises.
