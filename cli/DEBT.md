# Debt short-list

Found by auditing `src/` against `.claude/rules/` and by the end-to-end
command sweep. Ordered by value, not by effort.

## 1. `run-eval.ts` still does work the rules assign to services

The orchestrator rule says it sequences services and does "no scanning,
parsing, globbing or rendering of its own." Four things break that:

- **`assembleCohort` reads files** (`readText` at 208). A missing service:
  `services/assemble-cohort.ts`.
- **`summarize` is 31 lines of pure computation** over verdicts (212-251).
  A missing service: `services/summarize-verdicts.ts`. It is also the one
  piece of run-eval worth testing in isolation and currently cannot be.
- **`cacheStats` is a mutable accumulator** passed into `reviewUnit` and
  incremented there (180-181). `reviewUnit` returns a `TargetVerdict` *and*
  side-effects its argument. It should return `{ verdict, cacheHit }` and
  let the loop tally.
- **`reviewUnit`'s 9-field payload type is declared inline** (143-153),
  bypassing "types live in a types.ts".

## 2. The test suite never followed the architecture

525 tests pass, but **34 modules are never imported by any test** — the
suite still exercises the code through a handful of pre-refactor seams.
The services we extracted have no direct tests:

`discover-domains`, `resolve-units`, `list-target-paths`, `read-cache-file`,
`build-cache-identity`, `report-verdicts`, `summary` view, all six prompts,
`inline-references`, `write-profile-outputs`, `find-expert-by-alias`,
`compile-by-alias`, `targeting`, `compile-progress`, all seven workspace
services, `show-config`, `views/{badges,stats,table,report}`, `core/paths`.

Worst case: **`promptSurface()` has no direct test.** It decides cache
invalidation for every Praxis user, and the e2e sweep just proved a
one-word prompt edit rolls every reviewer hash. It deserves a lock test.

`tests/` also stopped mirroring `src/`: `judgment-input.test.ts` is a
pre-rename name covering three differently-named services, and
`verdict-cache-roundtrip.test.ts` mirrors nothing.

## 3. Inline payload types slip past the types.ts rule

ESLint bans `type`/`interface` declarations outside a `types.ts`, but an
inline object annotation is neither, so these went unnoticed:

| fields | file |
| --- | --- |
| 9 | `eval/orchestrators/run-eval.ts` |
| 5 | `workspace/orchestrators/init-project.ts` |
| 5 | `eval/views/progress.ts` |
| 4 | `eval/views/summary.ts` |
| 4 | `eval/services/build-verdict-report.ts` |

Name them, and consider extending the rule so it cannot recur.

## 4. Gaps the e2e sweep surfaced

- **`--type bogus` does not say what is valid.** `--reviewer bogus` lists
  `flash, v32, counter`; `unknownDocumentType` just echoes the input.
  `--type` also matches *domain basenames* (`experts`, `features`, `tests`),
  not document types — the name misleads.
- **No way to prune stale cache keys.** `cache-file.ts` calls keys belonging
  to no configured reviewer "prunable", but nothing prunes them. After a
  reviewer-hash epoch roll the old entries sit in committed JSON forever;
  the demo only stayed clean because the cache was deleted by hand.
- **`ignore` is undocumented.** `config show` reports it and the demo uses
  it; the config field list in `cli/CLAUDE.md` omits it.
