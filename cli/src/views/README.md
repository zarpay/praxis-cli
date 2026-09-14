# views/ — render moments

Pure functions from data to `ReportLine[]`, typed `View<Data>` — the
data shape declared in the view itself, unexported, unless a builder or
another surface shares it, in which case it joins the types barrel. A
view decides nothing and performs nothing; composite reports keep
sections as module-private helpers; reusable components (badges, stats,
tables, cards) live in the framework kit.

Rule: `.claude/rules/views.md`. Exemplar: `status-view.ts`.
