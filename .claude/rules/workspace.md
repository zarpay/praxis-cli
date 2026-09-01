---
description: What belongs in the workspace domain, and why others may reach into it
paths:
  - cli/src/domains/workspace/**
---

# Workspace

**Workspace knows what a Praxis project is** — where `.praxis/` lives, what `config.json` means, what documents are in the tree, and whether the project is healthy. If a thing is Praxis-specific but not about authoring or judging, it belongs here rather than in core.

Workspace is the **only domain the others may reach into**. `spec` and `eval` import its models and types — `PraxisConfig`, `Paths`, `DocumentFile` — and stay isolated from each other. That reach-in is scoped to `models/` and `types.ts`:

- **`models/` and `types.ts` may not import any domain.** They are the floor `spec` and `eval` stand on; depending back would be a cycle.
- **`services/`, `orchestrators/` and `views/` may read both layers.** The health slice (`audit-experts` → spec, `tally-validation` → eval, `analyze-project`) exists to report across them, so it sits above them and nothing but a command may import it.

Both halves are ESLint-enforced. When adding here, ask which half a file is in: if `spec` or `eval` will need it, it is a model or a type, and it must stay free of them.
