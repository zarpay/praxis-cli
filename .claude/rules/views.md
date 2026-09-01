---
description: What belongs in a views/ directory — the render kit and a domain's views
paths:
  - cli/src/views/**
  - cli/src/domains/*/views/**
---

# Views

**A view renders.** Pure functions returning `DisplayEntry[]` or strings, named
for what they render: `progress.ts`, `status.ts`, `summary.ts`, `targeting.ts`.
A command calls one when it has something to show.

- A view formats what it is given. It never performs work, reads files, decides
  what to do, or reaches for config — hand it data already resolved.
- Deciding *what* to show is still view logic and belongs here (`issueBlocks`
  drops empty blocks, `validationBlocks` drops reviewers with no verdicts).
  Deciding what to *do* is not.
- A report that interleaves stderr headings with stdout blocks returns
  `ReportLine[]` — each line names its channel — and the command prints it with
  one `renderReport()` call. Ordering and interleaving are the view's decisions,
  not the command's.
- `src/views/` is the shared kit — `display.ts` and `logger.ts` are the only
  modules allowed to call `console` (ESLint-enforced), and reusable rendering
  (`badges.ts`, `stats.ts`, `table.ts`, `report.ts`) lives there so callers stop hand-building
  badge literals and column padding.
