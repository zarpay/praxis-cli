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
  const typed `View<Data>` with the data shape in `src/types.ts`. Because every
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
  framework's kit (`@framework/views/`): `badge`, `badgeBlock`, `verdictTally`,
  `statLines`, `table`. They return entries and strings — ingredients, not
  reports. An app-level helper used by exactly one view stays private in that
  view.
- Streamed output is a view per event: `onProgress: (event) =>
ctx.render(runProgressView(event))`.
- Tests assert on the returned `ReportLine[]` (via `@tests/helpers/report-text`),
  never on captured stdout.
