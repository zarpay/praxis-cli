---
description: How code reads — one call per expression, named intermediates, flat algorithms
paths:
  - cli/src/**
  - cli/tests/**
  - cli/packages/**
---

# Legibility

**Boring-elegant code: every expression does one thing, and every
intermediate result has a name.** These rules exist because they were
each requested after real code violated them; the reference style is
`ci-run-orchestrator.ts`.

- **One call per expression — never nest calls.** Not in runtime code
  (`ctx.render(epochBoundaryView(detectEpochBoundariesService(...)))`)
  and not in test assertions (`expect(hash(reviewer({...}))).not.toBe(...)`).
  Extract clearly named consts first, then call or assert on them:

  ```ts
  const boundaries = detectEpochBoundariesService(cfg, { reviewers });
  const boundaryView = epochBoundaryView(boundaries);
  ctx.render(boundaryView);
  ```

- **Const before render, always.** An orchestrator assigns every service
  result and every view to a named const before `ctx.render`.
- **No nested ternaries** (lint-enforced), and **no large object
  literals inside a ternary's branch** — declare the alternative as a
  named const (`noEvidenceRow`), then a one-line ternary between two
  names.
- **Never encode data into strings to split it back out.** A composite
  key like `` `${axiomId} ${filePath}` `` may exist only as a private
  Set-membership detail that is never parsed; records stay records. If
  you are calling `.split()` on something you built, the design is
  wrong.
- **No loops inside loops.** One flat main function that reads as the
  algorithm's steps, each step a named single-purpose helper taking and
  returning domain records.
- **No `Parameters<typeof fn>[0]` gymnastics.** Name the type and use
  it — an inline conditional/indexed type where a named type exists is
  a puzzle, not a signature.
- Tests name their inputs and results for their *meaning*
  (`defaultHash`, `customProviderHash`), and `expect(...)` lines stay at
  a single call depth.
