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

**Rides along — done.** `array()` is now generic (`array<T = string>`), so every
`as string[]` in the codebase is gone: `eval-run.ts` x3, `status.ts`, `expert-compiler.ts`,
`judgment-input.ts`. The six `value(k) as string | undefined` sites moved to
`optionalValue(k)`. `inlineConstitution` dropped its hand-rolled
`Array.isArray(raw) ? raw : [raw]` for `array()`.

The `Frontmatter.paths(key, root)` accessor I proposed here is **not worth adding.**
Its justification was deleting casts, and generic `array()` already did that — what
remains is `fm.array("excludes").map((p) => joinPath(this.root, p))`, one clean line
at two call sites. A path-resolution helper on a frontmatter parser would drag
project-root knowledge into a YAML reader to save one `.map`.

Still open here: the three `fg.sync` calls themselves. Partly addressed already —
`syncOptions` is now built once per spec and mutated per branch.

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

## [x] 7. Typed document models (`src/models/`)

**Done.** `SpecFile` and `ExpertFile` — each names the frontmatter keys its
document kind honors, so those spellings live in one place instead of as string
literals at every reader.

What moved: `readCohort` (23 lines of enum validation and a throw) left `EvalRun`
for `SpecFile.cohort`, where it is testable against a string instead of requiring
a project and a discovery pass. `expert-compiler` stopped passing `Frontmatter`
through four private methods. `status.auditExperts` and `commands/compile` read
typed fields.

Both models are pure over content (`fromContent`), so their 25 tests need no
tmpdir at all — that is the real win, not the line count.

**Models validate on construction** (`models/fields.ts`): a missing required key
or a wrong-shaped value raises, so a model that exists is a valid document.
`ExpertFile.alias` is required; `cohort` is checked against the same enum
`SpecFile` uses, which moves an entire error class from eval time to compile time.

The batch callers absorb it rather than propagating: `compileAll` warns and skips
a malformed expert, `praxis status` reports it in a new `invalidExperts` bucket.
One bad file never abandons the run — that was the original worry, and it is
handled at the caller where it belongs, not by weakening the model.

**Cost accepted (see `CLAUDE.md`):** `src/models/` is a shared leaf, so the eval
layer is now _able_ to import `ExpertFile` — spec-layer taxonomy. The ESLint rule
stops models from importing either layer, but nothing stops that direction.
Taxonomy-free `@/eval` is convention here, not enforcement.

**Still reading `Frontmatter` directly, deliberately:** `status.ts` reads `type`
on arbitrary content files and `owner` on practices. Those want a third model
(`PracticeFile`) or a generic document reader; neither earns its keep yet.

---

## [x] 8. Retire the frontmatter-handling left behind by the models

**Done.** Once models validated on construction, the defensive code around them
was dead weight. Six removals:

1. `Markdown` was a **second implementation** of the frontmatter format — its own
   `DELIMITER`, its own `indexOf("\n---")` scan. `Frontmatter.body()` now owns it
   and `Markdown` delegates.
2. `buildExpertProfile` **read every expert file twice** (once via `ExpertFile`,
   again via `new Markdown(expert.path)`). `ExpertFile.body()` closes that.
3. The **alias slug** lived in the compiler and could produce `""`. It moved to
   `ExpertFile.agentName`, which raises on an alias with no letter or digit.
4. `AgentMetadata.validates/excludes/exemplars` became required `string[]`, so
   `output-builder` dropped `?? []` and two `&& x.length > 0` guards.
5. `claude-code.buildFrontmatter` re-checked `!name || !description` — both
   unreachable once 3 and 4 landed.
6. `ExpertCompiler.compile()` returned `string | null` for a null it can no
   longer produce; it returns `string` and throws instead.

**New model:** `DocumentFile` (`type`, `owner`, both optional) for `praxis status`
sweeping trees where the kind isn't known per file. That closes item 7's leftover
— no production code outside `src/models/` reads keys off `Frontmatter` any more.

---

## Considered and deliberately not scheduled

**Splitting `src/types.ts` (623 loc, the largest file).** `AgentMetadata`,
`CacheFile`, `ProviderRequest` and friends now sit far from their only consumers.
But the "one types home" rule is ESLint-enforced and deliberate (see `CLAUDE.md`),
and the banner sections already do most of the work a file split would. Changing
this is a convention decision, not a refactor — raise it as its own discussion if
the file keeps growing.
