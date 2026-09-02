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
  incremented there (180-181). `reviewUnit` returns a `TargetVerdict` _and_
  side-effects its argument. It should return `{ verdict, cacheHit }` and
  let the loop tally.
- **`reviewUnit`'s 9-field payload type is declared inline** (143-153),
  bypassing "types live in a types.ts".

## 2. Test coverage now follows the architecture — remaining gaps are listed

Reworked (2026-09-02): `tests/` mirrors `src/` one-to-one and every file tests
one module's public interface (`.claude/rules/tests.md`). `promptSurface()` is
hash-locked. 574 tests across 53 files.

Still without a direct suite, covered only indirectly or end-to-end:

- **orchestrators and commands** — deliberately: they are render-and-signal
  over tested services, exercised by `tests/integration/` and the demo sweep.
  (`edit-config` and `init-project` do have direct suites.)
- **discovery services** (`discover-domains`, `resolve-units`,
  `list-source-documents`, `list-target-paths`) — exercised through
  `review-all`'s scope/cohort/ignore suites, not directly.
- **status services** (`audit-experts`, `tally-validation`,
  `count-documents-by-type`, `count-status-issues`,
  `find-orphaned-practices`) — exercised through `build-status-report`.
- **compile internals** (`compile-expert`, `compile-by-alias`,
  `inline-references`, `write-profile-outputs`, `find-expert-by-alias`) —
  exercised through `compile-experts` and the claude-code plugin suite.
- `views/summary.ts`, `views/compile-progress.ts`, the three plugin/eval
  templates, and the four individual prompt modules (locked as a whole by
  the `prompt-surface` hash).

## 3. Inline payload types slip past the types.ts rule

ESLint bans `type`/`interface` declarations outside a `types.ts`, but an
inline object annotation is neither, so these went unnoticed:

| fields | file                                      |
| ------ | ----------------------------------------- |
| 9      | `eval/orchestrators/run-eval.ts`          |
| 5      | `workspace/orchestrators/init-project.ts` |
| 5      | `eval/views/progress.ts`                  |
| 4      | `eval/views/summary.ts`                   |
| 4      | `eval/services/build-verdict-report.ts`   |

Name them, and consider extending the rule so it cannot recur.

## 4. Gaps the e2e sweep surfaced

- **`--type bogus` does not say what is valid.** `--reviewer bogus` lists
  `flash, v32, counter`; `unknownDocumentType` just echoes the input.
  `--type` also matches _domain basenames_ (`experts`, `features`, `tests`),
  not document types — the name misleads.
- **No way to prune stale cache keys.** `cache-file.ts` calls keys belonging
  to no configured reviewer "prunable", but nothing prunes them. After a
  reviewer-hash epoch roll the old entries sit in committed JSON forever;
  the demo only stayed clean because the cache was deleted by hand.
- **`ignore` is undocumented.** `config show` reports it and the demo uses
  it; the config field list in `cli/CLAUDE.md` omits it.
