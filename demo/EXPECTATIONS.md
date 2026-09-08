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
| Spec pattern | `{README.md,*.sme.md}` — hand-authored READMEs plus the hand-authored `experts.sme.md` (compiled profiles land in `agent-profiles/*.expert.md`, which is not a source dir and does not govern) |
| Corpus units | 17 per reviewer (51 verdicts across three reviewers) — awards is exemplar-shielded |
| Axioms | 13 total: 11 active, 2 deprecated (AX-96ff9c; AX-fac03c merged into AX-b951db 2026-09-07); ids under `.praxis/axioms/` |
| Known real findings (corpus) | flash 2 failing, v32 2 failing, counter 0 (re-baselined at the 2026-09-07 epoch) |
| Known violating files | `src/features/flavor-of-day/` and `src/services/rank-parlors.ts` (both reviewers) |
| Signature merge | AX-fac03c → AX-b951db (2026-09-07): 8 critiques re-labeled by merge records; `eval report --axiom AX-b951db` counts them |
| Exemplar / excluded / wip | `create-review.ts` exemplar · `src/features/awards/*` cohort exemplar (blessed 2026-09-08 — the awards directory is shielded from review and inlined as the features spec's positive example) · `legacy-import.ts` excluded · `_wip-refund.ts` template-skipped. Nuance: excludes shield **full runs only** — `eval run src/services/legacy-import.ts` reviews it on explicit ask (exit 0, evidence on record 2026-09-08) |
| Signature axiom | AX-b951db — error messages name what was wrong and what would be accepted |

## The matrix

Legend: **[free]** offline or cache-only · **[paid]** real reviewer
calls · **[scratch]** run in a copy.

### Orientation and health [free]

| Command | Expect |
| --- | --- |
| bare `praxis` [free] | Orientation: last run + calibration, blank line, taxonomy + the two queues, blank line, per-reviewer debt lines, reports footer |
| `praxis status` | Per-reviewer PASS/WARN/FAIL/NOT VALIDATED blocks (never pooled); counts for experts/practices/references/context; exits 0 with `No issues found` |
| `praxis config show` | Header with the config path, then the raw file as written |

### Compile (spec layer) [free]

| Command | Expect |
| --- | --- |
| `praxis compile` | `Compiled 3 agent(s)` — scooper, sundae, taster; profiles in `agent-profiles/`, plugin output in `plugins/praxis/` (agents + `praxis-resolve.md` + skill) |
| `praxis compile --alias scooper` | One agent, case-insensitive alias match |
| `praxis compile --alias nope` | Instructive `No expert found with alias` error naming the known aliases, exit 2 (usage error) |
| Compiled `scooper.expert.md` | Opens with eval-targeting frontmatter (`paths: src/services/*.ts`, exemplars, excludes) — the profile IS a spec |
| `compile --watch` [manual only] | Watches source dirs (any file change, debounced) — human-driven; not part of the scripted audit |
| `config edit` [manual only] | Opens $VISUAL/$EDITOR — human-driven; agents read with `config show` |

### The eval loop

| Command | Expect |
| --- | --- |
| `eval run --reviewer counter` [free] | **The canary**: all cache hits, 0 misses, `[Errors] 0` on an unchanged corpus. On a branch that changed source files, exactly those files miss (content misses, deterministic and free) — an *identity* miss is the epoch event; a *content* miss on a changed file is the cache working (nuance recorded 2026-09-05). The 2026-09-07 review→label epoch was the deliberate exception: 18 identity misses, `baseline: true` |
| `eval run` (all reviewers) [free when warm] | 54 hits; summary shows per-type and by-reviewer blocks; errors = known real findings; header reads "corpus conformance (includes pre-spec debt)" |
| `eval run src/services/redeem-coupon.ts --reviewer v32` [paid on miss] | Fast loop: critiques print **raw** (reviewer prose against the spec — never an `[AX-…]` citation at review time; labels arrive at triage and show in reports); ledger gains a `scope: "files"` run with critiques born `axiom_id: null` |
| `eval run knowledge/experts/service-steward.md` [free when warm] | The `*.sme.md` half of specFilePattern governs: the expert doc reviews against `experts.sme.md` |
| `eval run --type tests --reviewer counter` [free] | Domain filter: only the tests domain's 6 units run (all hits when warm) |
| `eval run --fail-fast --reviewer flash` [free when warm] | Stops at the first error verdict — flavor-of-day fails and later domains never print (verified 2026-09-08: 5 hits then stop) |
| `eval run <target> --spec <path>` [paid on miss] | Spec override honors exactly one named target; with several targets it is silently dropped (each falls back to its governing spec) — a known nuance |
| `eval run src/generated/summary.md` [free] | Ignored path: exits 1 with the instructive no-spec error (`ignore` removes it from discovery; naming it finds no governing spec) |
| `eval run --json` / `eval verdict <t> --json` / `status --json` / `praxis --json` [free] | Stable machine contracts: orientation carries pendingTriage/awaitingCuration/debtLine; status.evalState carries pending_triage, awaiting_curation, proposals_pending, epoch_boundary_detected, last_run_at |
| `eval ci` / `eval ci --strict` [free when warm] | Read-only verify: no ledger write, cache never written; exits 1 on errors + unverified (strict adds warnings). Demo state: exits 1 (flavor-of-day, rank-parlors) |
| `eval run <target> --no-cache --verbose` [paid] | Fresh review, reasoning printed |
| Dirty-tree run | Anchoring warning ("feedback, not measurement"); run records carry `commit_sha: null` |
| `eval verdict src/services/redeem-coupon.ts` [free] | Cached verdict per reviewer, no API call; exit 2 on a target that does not exist |
| STALE verdict [scratch, free] | `echo "// drift" >> src/services/redeem-coupon.ts` in a copy → `eval verdict` shows `[STALE] Cached result is outdated` for every reviewer (verified 2026-09-08) |
| Deterministic UNVERIFIED [scratch, free] | `chmod 000 src/services/rank-parlors.ts` in a copy → `eval run --reviewer counter` reports the unit UNVERIFIED and exits 1; `eval ci` likewise. Free and reproducible — no flash quirk needed |
| `eval prune` [free] | Prunes only orphaned reviewer hashes; after the 2026-09-07 epoch it swept 57 pre-epoch entries (canary stayed all-hits — live entries untouched). A second run finds nothing to do |

### Reports (pure reads — never a reviewer call) [free]

| Command | Expect |
| --- | --- |
| `eval report --axiom AX-b951db` | Drill-down: statement, derivation, per-reviewer blocks, example critiques with ledger ids — includes the 8 critiques merged in from AX-fac03c |
| `eval report --axiom AX-96ff9c` | A deprecated axiom still reports: history stays readable |
| `eval report "src/services/*.ts"` / `--since <date>` / `--branch <name>` / `--commits <shas...>` | Scopes compose; each narrows Runs/Critiques honestly (verified 2026-09-08) |
| `eval report --commit deadbeef123` | Short missing-commit warning + indented forensics block — never an error |
| `debt report` | Per-reviewer evidence line (baseline date · current as-evidenced date); per-axiom baseline→current, paydown, appeared; concentration by directory; paydown credit by git author or the unanchored note |

### Axioms [free to read; scratch for lifecycle]

| Command | Expect |
| --- | --- |
| `axioms list` | 13 axioms, chronological; proposals counted with the ratify pointer |
| `eval critiques [target] --state/--axiom/--json` [free] | Browsable critique cards with ids and lifecycle states; ledger-wide tallies in the heading (verified 2026-09-08) |
| `axioms reassign <critique-id> --to <axiom>` [scratch] | Appends a human assignment that wins at read time; exit 2 on an unknown critique id or a non-active axiom (verified 2026-09-08 in scratch) |
| `axioms show AX-b951db` | Statement, both examples, grounding, lifecycle; `--json` stable |
| `axioms triage` [scratch, paid] | The labeling pass over **untriaged** critiques only: one curator call each (order can't bias a verdict), per-verdict progress lines; matches land as matcher assignments, no-matches as unmatched records (→ curate's queue, re-queued for triage if the axiom set changes); hallucinated ids = failed calls, stay untriaged; `--dry-run` writes nothing; no curator → warns "labeling is deferred" |
| `axioms curate --reject "<reason>"` [scratch] | Dismisses the **unmatched** queue (untriaged critiques are named and untouched), writes a triage session file, no curator call |
| `axioms deprecate <id> --reason` [scratch] | Status flips to deprecated, body untouched, deprecation record in the ledger; reports keep the id's history readable |
| `axioms merge <ids...> --into <id>` [scratch] | Losers deprecate, their critiques re-label to the survivor (decision "merge"), survivor's introduced moves to the earliest among the merged; `eval report --axiom <survivor>` immediately counts the merged evidence |
| `axioms curate --yes` [scratch, paid] | Clusters the unmatched residue (cohorts of ~30, duplicates deduped with ×N): accepted assigns/dismissals land as records, proposals pass the gate first (mechanical clusters refused, same-remediation drafts folded into the existing axiom). Untriaged critiques are named and deferred to triage. Verified 2026-09-08 at 19 critiques: 2 assigned, 1 proposed, 6 dismissed, 11 gate-skipped |
| `axioms ratify <id>` `--yes/--reject/--spec` [scratch, paid] | Gate + duplication check + traceability, then the human call; `--reject` records reviewer noise; untraceable → exit 1, extend the spec. Ratification has **no cache effect**: the next run stays all-hits |
| `axioms audit` [scratch, paid] | Gate re-run over active axioms; flags mechanical standards and `≈` same-remediation twins with the merge command ready (found AX-b951db ≈ AX-fac03c before their 2026-09-07 merge) |

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
