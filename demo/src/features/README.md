---
paths:
  - "src/features/*"
cohort: by_directory
context:
  - "src/domain/types.ts"
  - "src/store/memory-store.ts"
---

# Feature Module Conventions

A feature is a directory under `src/features/` that composes domain
logic into one user-facing capability. Features are judged **as a
set** — each directory is one evaluation unit — because every rule
here is about how the files relate, not about any file alone.

## Structure

- Exactly one entry point, `index.ts`, which re-exports the feature's
  entire public API. Nothing outside the feature imports any other
  file in it.
- Types live in a dedicated `<feature>-types.ts` file.
- Logic files are verb-first kebab-case (`build-menu.ts`,
  `pick-winners.ts`) and follow the service conventions
  (`src/services/README.md`): one exported `run`, Results over
  exceptions, consumer-grade error messages.

## Cohesion

- **No orphaned files**: every file in the directory is reachable from
  `index.ts` through its import graph.
- **One capability per feature**: if the files serve two unrelated
  purposes, they are two features.
- The feature's name describes the capability (`tasting-menu`), not
  its implementation.
