# views/ — render moments

Pure functions from data to `ReportLine[]`, typed `View<Data>` with the
data shape named in the types barrel. A view decides nothing and
performs nothing; composite reports keep sections as module-private
helpers; reusable components (badges, stats, tables) live in the
framework kit.

Rule: `.claude/rules/views.md`. Exemplar: `status-view.ts`.
