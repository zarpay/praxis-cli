# Refactor short-list

Cleanups in the spirit of the `Frontmatter.optionalValue`/`optionalArray` change:
push knowledge down to where the data lives, so call sites shrink and the logic
becomes directly testable. Ordered by payoff-to-risk. Check off as they land.

Ground rule for every item: no behavior change unless the item says otherwise.
`npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm test` all
green before the commit, and `demo/` recompiles byte-identical.

---

## [x] 1. One `EvalRun` factory — kill the three-copy construction

**Done.** `EvalRun.forProject(root, config, overrides?)` (`src/eval/eval-run.ts`).
The three call sites — `eval.ts` `all()` and `ci()`, `status.ts` `tallyValidation()`
— are now one line each; `status.ts` is a bare `forProject(this.root, this.config)`.

**Open question, resolved:** `ci()` omitting `useCache` is _not_ a bug. `eval ci`
registers only `--strict` (no `--no-cache`), so it has no cache preference to
pass, and the constructor already defaults `useCache` to `true` — which is what
CI wants. The factory's omitted-override fallback preserves this exactly. No
behavior change.

Five tests added in `tests/eval/eval-run.test.ts` covering the config projection,
the fail-fast default and override, and that the judges override actually narrows
which judges run.

---

## [ ] 2. `CacheManager` — the corrupt-file dance appears twice

**Where:** `src/eval/cache-manager.ts:140-155` and `:186-198`

Both sites are the same shape: try/catch → nested try/catch to `removeFile` →
`if (process.env["DEBUG"]) logger.warn`. That is the only place `DEBUG` is read
in the entire codebase, and it is read twice. Extract
`private discardCorruptFile(cachePath, err, context)`.

While in here: `write()` (65 lines) and `read()` (50) both re-derive `cachePath`
and `verdictKey` — an internal `entryFor(targetPath, specPath)` pairs them.

Pure deduplication, no hot-path risk. Good one to do alongside #1.

---

## [ ] 3. `EvalRun.validateUnit()` — 79 lines, the longest real function in src/

**Where:** `src/eval/eval-run.ts:422`

Does five separable jobs: compute display labels, construct the `Judge`, tally
cache stats, format verdict output, build the error `TargetVerdict`. The `catch`
hand-builds a `TargetVerdict` duplicating the success path's shape, and
`(err as Error).message` appears three times inside it.

Split into `unitLabel(unit, judgeConfig)`, `runJudge(...)`, and
`errorVerdict(unit, type, judge, err)` — body drops to roughly 20 lines.

**Testability:** the label logic (`isCohort`, cohort/judge suffixes) is pure
string work that today can only be reached by running a full judged eval.

**Risk:** touches the hot path. Do it after #1 and #2, on its own commit.

---

## [ ] 4. `discoverValidationDomains()` — three near-identical `fg.sync` calls

**Where:** `src/eval/eval-run.ts:322`

The `by_directory`, `paths:`-present, and bare branches repeat the same
`{ cwd: this.root, absolute: true, dot: true, ignore: shielded }` block, varying
only by `onlyFiles`/`onlyDirectories` and a post-filter. Extract
`globTargets(patterns, shielded, mode)` so the three-way branch reads as policy
rather than plumbing.

**Rides along:** this is prime `Frontmatter` territory. `fm.array("paths") as string[]`,
`(fm.array("excludes") as string[]).map(...)`, and `(fm.array("exemplars") as string[]).map(...)`
all carry the same cast-then-absolutize. A `Frontmatter.paths(key, root)` accessor
deletes three casts here and more in `src/eval/judgment-input.ts`.

---

## [ ] 5. `StatusCommand.display()` — 75 lines that are nearly already a table

**Where:** `src/commands/status.ts:223`

The `issueBlocks` array at the bottom is already the right idea: declarative
pairs, one loop. The top half (counts block, per-judge validation block) is still
hand-rolled. Lift those into the same declarative shape and the method becomes a
data structure plus one renderer.

**Testability:** lets you assert which blocks a report produces without capturing
stdout.

---

## [ ] 6. Test coverage gaps

- `src/eval/judgment-input.ts` (94 loc) — **no test file.** Pure functions over
  file contents; the easiest possible thing to test and currently untested.
- `src/commands/eval.ts` (375 loc) — **no direct test file.** `EvalCommand` is
  only exercised indirectly through `eval-run.test.ts`.
- `src/prompts/*` — untested, but mostly template strings where a snapshot is
  low-value. Lowest priority of the three.

---

## Considered and deliberately not scheduled

**Splitting `src/types.ts` (623 loc, the largest file).** `AgentMetadata`,
`CacheFile`, `ProviderRequest` and friends now sit far from their only consumers.
But the "one types home" rule is ESLint-enforced and deliberate (see `CLAUDE.md`),
and the banner sections already do most of the work a file split would. Changing
this is a convention decision, not a refactor — raise it as its own discussion if
the file keeps growing.
