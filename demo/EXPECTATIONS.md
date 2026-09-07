# Demo Expectations — the feature/expectation matrix

The authoritative end-to-end acceptance matrix for the CLI, run against
this demo (Scoop Society) by the `demo-audit` skill. **Maintain it like
code**: when a feature changes behavior or the demo's state moves (new
axioms, new ledger evidence, resolved debt), update the affected rows in
the same commit. Expectations are written as *invariants* wherever
counts naturally drift, and as exact values only where drift would mean
a bug.

## Ground rules for the audit

- Build first: `cd cli && npm run build` (the demo runs `file:../cli`).
- Real reviews need `OPENROUTER_API_KEY` in the environment (ask the
  owner how it is provided on this machine; never commit it).
- **The canary is sacred**: `npx praxis eval run --reviewer counter`
  must be *all cache hits, zero misses*. Any miss means reviewer
  identity changed — an epoch event that must be deliberate. Run it
  after every code change, before anything else. (One deliberate epoch
  on record: 2026-09-07, review→label — prompt surface and tool schema
  changed once; that canary re-baselined at 18 misses.)
- **Destructive or curator-spending commands run in a scratch copy**
  (`cp -r demo <scratch>`), never against the real demo: `axioms triage`
  (curator spend; writes matcher assignment records), `axioms curate`
  (consumes the pending queue; curator spend unless `--reject`),
  `axioms ratify`, `axioms audit` (curator spend per active axiom).
  Exception: a milestone's own acceptance run may land triage/curate
  evidence in the real demo deliberately — say so in the commit.
- `eval run` writes ledger evidence by design — commit the new run files
  with the audit (10-k). `eval ci` must write **nothing**.
- **Real reviewers are the default for everything judgment-shaped.**
  We are not price-sensitive; the audit's value is live model output,
  so [paid] rows always run with `flash`/`v32` — `counter` covers only
  the canary and the custom-provider contract. Known live quirk:
  `flash` intermittently returns invalid tool-call JSON when critique
  text echoes quoted strings. That correctly yields UNVERIFIED with an
  instructive provider error — the system working, not a bug. Prefer
  `v32` when an assertion needs a completed live verdict.

## Current demo state (update when it moves)

| Fact | Value |
| --- | --- |
| Reviewers | `flash` (deepseek-v4-flash-0731), `v32` (deepseek-v3.2), `counter` (offline `./praxis-providers/word-count.js`) |
| Curator | anthropic/claude-sonnet-4.5 |
| Spec pattern | `{README.md,*.sme.md}` — hand-authored READMEs and compiled profiles both govern |
| Corpus units | 18 per reviewer (54 verdicts across three reviewers) |
| Axioms | 13 total: 12 active, 1 deprecated (AX-96ff9c); ids under `.praxis/axioms/` |
| Known real findings (corpus) | flash 2 failing, v32 2 failing, counter 0 (re-baselined at the 2026-09-07 epoch) |
| Known violating files | `src/features/flavor-of-day/` and `src/services/rank-parlors.ts` (both reviewers) |
| Exemplar / excluded / wip | `create-review.ts` exemplar · `legacy-import.ts` excluded · `_wip-refund.ts` template-skipped |
| Signature axiom | AX-b951db — error messages name what was wrong and what would be accepted |

## The matrix

Legend: **[free]** offline or cache-only · **[paid]** real reviewer
calls · **[scratch]** run in a copy.

### Orientation and health [free]

| Command | Expect |
| --- | --- |
| `praxis status` | Per-reviewer PASS/WARN/FAIL/NOT VALIDATED blocks (never pooled); counts for experts/practices/references/context; exits 0 with `No issues found` |
| `praxis config show` | Header with the config path, then the raw file as written |

### Compile (spec layer) [free]

| Command | Expect |
| --- | --- |
| `praxis compile` | `Compiled 3 agent(s)` — scooper, sundae, taster; profiles in `agent-profiles/`, plugin output in `plugins/praxis/` (agents + `praxis-resolve.md` + skill) |
| `praxis compile --alias scooper` | One agent, case-insensitive alias match |
| `praxis compile --alias nope` | Instructive `No expert found with alias` error naming the known aliases, exit 2 (usage error) |
| Compiled `scooper.md` | Opens with eval-targeting frontmatter (`paths: src/services/*.ts`, exemplars, excludes) — the profile IS a spec |

### The eval loop

| Command | Expect |
| --- | --- |
| `eval run --reviewer counter` [free] | **The canary**: all cache hits, 0 misses, `[Errors] 0` on an unchanged corpus. On a branch that changed source files, exactly those files miss (content misses, deterministic and free) — an *identity* miss is the epoch event; a *content* miss on a changed file is the cache working (nuance recorded 2026-09-05). The 2026-09-07 review→label epoch was the deliberate exception: 18 identity misses, `baseline: true` |
| `eval run` (all reviewers) [free when warm] | 54 hits; summary shows per-type and by-reviewer blocks; errors = known real findings; header reads "corpus conformance (includes pre-spec debt)" |
| `eval run src/services/redeem-coupon.ts --reviewer v32` [paid on miss] | Fast loop: critiques print **raw** (reviewer prose against the spec — never an `[AX-…]` citation at review time; labels arrive at triage and show in reports); ledger gains a `scope: "files"` run with critiques born `axiom_id: null` |
| `eval run <target> --no-cache --verbose` [paid] | Fresh review, reasoning printed |
| Dirty-tree run | Anchoring warning ("feedback, not measurement"); run records carry `commit_sha: null` |
| `eval verdict src/services/redeem-coupon.ts` [free] | Cached verdict per reviewer, no API call; STALE when the file changed since |
| `eval prune` [free] | "Nothing to prune" when all reviewers current; prunes only orphaned hashes |

### Reports (pure reads — never a reviewer call) [free]

| Command | Expect |
| --- | --- |
| `eval report --axiom AX-b951db` | Drill-down: statement, grounding, per-reviewer rows, example critiques with ledger ids |
| `eval report --commit deadbeef123` | The missing-commit note, verbatim from spec 12 — warning, never an error |
| `debt report` | Per-reviewer evidence line (baseline date · current as-evidenced date); per-axiom baseline→current, paydown, appeared; concentration by directory; paydown credit by git author or the unanchored note |

### Axioms [free to read; scratch for lifecycle]

| Command | Expect |
| --- | --- |
| `axioms list` | 13 axioms, chronological; proposals counted with the ratify pointer |
| `axioms show AX-b951db` | Statement, both examples, grounding, lifecycle; `--json` stable |
| `axioms triage` [scratch, paid] | The labeling pass: batch-labels pending critiques against each spec's active axioms; matcher assignment records land in `.praxis/ledger/triage/`; hallucinated ids never written; `--dry-run` proposes without writing; no curator → warns "labeling is deferred" |
| `axioms curate --reject "<reason>"` [scratch] | Dismisses the pending queue, writes a triage session file, no curator call |
| `axioms curate` / `ratify` / `audit` [scratch, paid] | Curator clusters the residue / traceability gates / gate re-runs — exercise only when the milestone touched them. Ratification has **no cache effect**: the next run after a ratify stays all-hits |

### Project lifecycle [scratch]

| Command | Expect |
| --- | --- |
| `praxis init` (empty dir) | Writes only `.praxis/config.json` |
| `praxis init --spec-layer` | Adds the authoring taxonomy; re-run never overwrites |
| `praxis add expert <n>` / `add practice <n>` | Scaffolds from template into configured dirs; refuses to overwrite |

## After the audit

1. Re-run the canary one final time.
2. Commit new demo ledger evidence.
3. If any row's expectation drifted for a *good* reason, update this
   file in the same commit — the matrix must always describe the demo
   as it is.
