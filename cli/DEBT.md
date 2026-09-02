# Debt short-list

Refreshed 2026-09-02 after the layers restructure and the debt-fix pass.
Items about run-eval's internals, inline payload types, the unhelpful
`--type` error, missing `ignore` documentation, and cache pruning are
resolved (`praxis eval prune` exists now). What remains:

## Coverage that is deliberate, and coverage that is missing

`tests/` mirrors `src/` one-to-one and every file tests one module's public
interface (`.claude/rules/tests.md`). `promptSurface()` is hash-locked.

Still without a direct suite, covered only indirectly or end-to-end:

- **orchestrators and commands** — deliberately: they are render-and-signal
  over tested services, exercised by `tests/integration/` and the demo sweep.
  (`edit-config`, `init-project` and the prune path do have direct suites.)
- **discovery services** (`discover-domains`, `resolve-units`,
  `list-source-documents`, `list-target-paths`) — exercised through
  `review-all`'s scope/cohort/ignore suites, not directly.
- **status services** (`audit-experts`, `tally-validation`,
  `count-documents-by-type`, `count-status-issues`,
  `find-orphaned-practices`) — exercised through `build-status-report`.
- **compile internals** (`compile-expert`, `compile-by-alias`,
  `inline-references`, `write-profile-outputs`, `find-expert-by-alias`) —
  exercised through `compile-experts` and the claude-code plugin suite.
- `run-report-view`, `eval-headline-view`, `compile-*` and `watch` views,
  the two plugin document templates, and the four individual prompt
  modules (locked as a whole by the `prompt-surface` hash).

## Known rough edges, not yet worth their fix

- **`--type` matches domain type labels** (`tests`, `src/features`), which are
  directory-shaped, and also directory basenames. The error now lists the
  valid values, but the flag name still suggests document frontmatter types.
- **`SCAFFOLD_DIR` resolves correctly only from the built bundle**
  (`models/project-paths.ts`); under `tsx src/index.ts` it points at a
  nonexistent path. Every test injects, so nothing exercises the default —
  a packaging smoke test (`npm pack` → install → `praxis init`) would.
- **`praxis-skill-template.ts` hardcodes `*.sme.md` and `.claude/agents/`**
  in its prose — true for this repo, not for a user's project, despite both
  being configurable.
