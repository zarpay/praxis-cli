---
description: What belongs in a domain's orchestrators/ directory
paths:
  - cli/src/domains/*/orchestrators/**
---

# Orchestrators

An orchestrator is **one workflow**, named `{verb}-{noun}` for the command it
serves: `run-eval.ts`, `compile-experts.ts`, `analyze-project.ts`,
`init-project.ts`. It is the primary interface a command calls.

- Same shape as a service: one file, one `export default function`, one named
  input payload and one named result type in the domain's `types.ts`.
- It **sequences services**. It does no scanning, parsing, globbing or rendering
  of its own — if it is doing the work itself, that work is a missing service.
- **Never prints.** Streamed output goes through an optional `onProgress`
  callback emitting typed events (`EvalProgress`, `CompileProgress`); the command
  renders them. That keeps long runs reporting as they go while the orchestrator
  holds no output stream, and lets a test collect the events as data.
- Failures that should not abandon the run come back in the result (a skipped
  file, an error verdict); only a genuinely unusable input raises.
