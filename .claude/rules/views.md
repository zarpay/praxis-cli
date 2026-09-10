---
description: What belongs in src/views — one render moment each, as a View
paths:
  - cli/src/views/**
---

# Views

**A view is one render moment**: a pure function from its data to a report
ready to render, typed by the framework —

```ts
export type View<Data> = (data: Data) => ReportLine[];
```

- **Named `{name}-view.ts`, default-exporting the filename in camelCase**, its
  const typed `View<Data>` — the data shape declared in the view itself
  (unexported) when only this view renders it, in the barrel when the
  builder or another surface shares it (`.claude/rules/types.md`). Because every
  view returns the same thing, every caller renders the same way:
  `ctx.render(statusView(report))`. There is no other verb — no `out.line`, no
  `out.print`, no `renderReport` at a call site.
- **A view decides nothing and performs nothing.** No I/O, no computation
  beyond arranging what it was given. If it needs a value the data does not
  carry, the service that built the data is missing a field.
- **One large view is fine.** A composite report (`status-view`,
  `verdict-reports-view`, `run-report-view`) keeps its sections as
  module-private helpers — split a piece out only when it is independently
  reusable, not to make files smaller.
- **Components are the smaller parts views compose**, and they live in the
  framework's kit (`@framework/views/`): `palette` (the semantic colors —
  every color has exactly one meaning, and views never call chalk
  directly), `table` (outlined, ANSI-aware), `card` (title · attrs ·
  body · footer — the one shape for anything shown one-at-a-time),
  `frame` (a report's opening: bold title + scope facts as named cells),
  `verdictTally` (the one-line colored-dot tally), `badge`/`badgeBlock`,
  `statLines`, `rule`. They return entries and strings — ingredients,
  not reports. An app-level helper used by exactly one view stays private in that
  view.
- **Using the kit is mandatory, not stylistic** (owner, 2026-09-10:
  "everything should"). A view never hand-rolls what a component
  provides: no `padEnd`/`padStart` alignment (that is `statLines` or
  `table`), no `"─".repeat(...)` dividers (that is `rule`, or the
  `{ header }` entry when titled), no `{ badge, color, value }` object
  literals or inline `chalk.green("[PASS]")` strings (that is `badge`/
  `badgeBlock` — hand-built literals are how the indents drifted).
  When the kit lacks the ingredient, add it to the kit with a mirrored
  test — `rule` earned its place exactly this way — rather than
  hand-rolling at the call site. Two sanctioned exceptions, both
  because a whole-line badge entry cannot express them: a colored
  `[LABEL]` *inside a sentence* (verdict-reports' `Status:` line, the
  `[reviewer]` provenance tags on critique cards), and the stream
  counters (`[3/12]` opening a progress line) — typography, not a
  status badge, and `dim`/`bold` are not badge colors.
- Streamed output is a view per event: `onProgress: (event) =>
ctx.render(runProgressView(event))`.
- Tests assert on the returned `ReportLine[]` (via `@tests/helpers/report-text`),
  never on captured stdout.
