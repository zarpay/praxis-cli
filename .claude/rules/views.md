---
description: What belongs in a views/ directory — the render kit and a domain's views
paths:
  - cli/src/views/**
  - cli/src/domains/*/views/**
---

# Views

A view is **rendering only**, named for what it renders: `progress.ts`,
`status.ts`, `targeting.ts`, `verdict-report.ts`. Pure functions returning
`DisplayEntry[]` or strings.

- A view formats what it is given. It never performs work, reads files, decides
  what to do, or reaches for config — hand it the data already resolved.
- Deciding *what* to show is still view logic and belongs here (`issueBlocks`
  drops empty blocks, `validationBlocks` drops judges with no verdicts). Deciding
  what to *do* is not.
- `src/views/` is the shared kit — `display.ts` and `logger.ts` are the only
  modules allowed to call `console` (ESLint-enforced), and reusable rendering
  (`badges.ts`, `stats.ts`, `table.ts`) lives there so callers stop hand-building
  badge literals and column padding.
