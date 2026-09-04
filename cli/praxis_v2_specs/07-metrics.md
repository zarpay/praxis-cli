# 07 — Metrics and Reporting

**Status:** Early draft — capturing conversation output
**Depends on:** all prior docs; this is where their constraints become visible surface

## Hard rules (violating these is a bug, not a style choice)

1. **Coverage and conformance render together, always.** A conformance figure without its coverage denominator is not printed. Rising conformance + falling coverage renders as a warning, not a win.
2. **Every conformance number carries a population qualifier** (01). Unqualified "conformance" does not appear in any output.
3. **Rates over counts, with denominators shown** — violations _per applicable opportunity_ (vocabulary), and the opportunity count is displayed, with small-n suppression (02): cells under the floor render as "insufficient data," never as a rate.
4. **Calibration status appears on every report** (06). Stale calibration marks affected numbers uninterpretable.
5. **No cross-species leaderboards** (02): where the optional human/agent contrast exists at all, it renders as per-axiom diagnostic evidence, never as an overall ranking — and only after the unknown-authorship rate is displayed.
6. **Nothing is charted across an epoch boundary** (02). Epochs — maximal intervals of stable spec hashes + reviewer config — are derived from provenance; boundaries render as named, first-class events ("model → sonnet-4.6", "events spec v3"), and each epoch opens with its baseline. Axiom version changes and removals (04) break that axiom's line the same way.
7. **One reviewer, one series** (06). With multiple reviewers configured, conformance renders per reviewer, never silently pooled — two instruments with different error rates do not average into one number. Cross-reviewer views render agreement/disagreement per axiom, which is a statement about the reviewers, not the code.

## Report surfaces

**`praxis eval report [--since <ref>] [--branch] [--json]`** — the eval. Leads with post-spec, within-epoch results:

- Coverage of post-spec diffs (how much new work was visible to any spec — and how much was invisible)
- **Introduction rate per axiom** — the struggle signal (02): flat-while-others-decline is the harness finding
- Violation flow: introduced vs resolved per applicable opportunity (01), against the reviewer-variance noise floor — implemented 2026-09-05: an introduction at or below the reviewer's measured per-axiom flag-count variance (from `calibrate run --repeat`) renders "below reviewer noise floor", never as a finding
- Residual rate (04) and calibration status (06)
- Cost: tokens/dollars per run, per diff, trend
- The human/agent contrast, only where attribution conventions are configured (02), unknown-rate first

**`praxis debt report`** — the baseline and paydown surface (02), honestly named. Debt stock per axiom at baseline, paydown flow since — **attributable per author (git identity of the resolving commit) and per directory**, credit being attributable where blame is not (02) — debt concentration by directory, re-baseline deltas across epoch boundaries. This is where the current `validate all` output migrates.

**Report scoping (decided 2026-09-02):** `eval report` answers at three levels, each printing the same core panel — runs counted, critiques collected, cost, files touched, and the reviewers and specs involved:

1. **Files or glob** — `eval report <path|glob>`: everything the ledger knows about those targets.
2. **Commit** — `eval report --commit <sha>`: the runs anchored to that commit. By construction this only finds clean-tree runs (12: working-tree runs carry `commit_sha: null` and are feedback, not measurement).
3. **PR** — a set of commits (`--commits <sha...>`, or resolved from a branch range): the union of level 2 over the set, deduplicated by run. A recorded sha that no longer resolves renders the missing-commit note (12, Anchoring) — squash workflows orphan branch shas by policy, and the run's attestation, branch, and date stay fully usable; only byte reconstruction is lost.

**`praxis eval report --axiom AX-0007`** — one axiom across everything: rates per population, trend, residual critiques nearby, calibration scores, removal-candidacy signals (03).

**Implementation notes (2026-09-03, flagged):** the small-n floor is **5** (`metrics-helper`, one constant — promote to config only when a real need appears); every renderer formats rates through the shared `rateCell`, which is how "enforced in every renderer" is enforced. Run records carry `spec_units` (05) — evaluated units per governing spec — as the applicable-opportunity denominator; records predating the field suppress as insufficient data rather than padding. The per-axiom rate reported is **current stock**: distinct violating files at the reviewer's latest **evidenced** scoped corpus run (`cache_misses > 0`) over its spec's opportunities. An all-hit run restates no critiques (05: cache hits write none), so it never moves the evidence anchor — reports print the anchor's date (`asOf`, and the debt report's per-reviewer evidence line) so staleness is visible rather than read as zero stock (sharpened 2026-09-04, after a live all-hit run blanked the demo's debt report). A *mixed* run's critique set covers only its fresh units, so current stock remains an approximation until M5's per-unit flow evidence supersedes it. Flow metrics landed with M5 (2026-09-04): `eval report`'s flow section computes over each branch's **latest** diff run per reviewer (reruns replace the picture, 12) within the reviewer's **current** epoch (rule 6), and the introduction rate is post-spec introduced violations over the diff runs' own `spec_units` — populations from each head sha's commit date against the axiom's clock, unknown when the sha expired. The debt report's paydown remains corpus-level set-difference; per-unit paydown sharpens as diff coverage accumulates. Open question 1 resolves as tentatively drawn: **run-indexed with calendar annotations**.

## Presentation idiom

Follow the existing pattern (`VerdictReporter` in `verdict-reporter.ts`): a pure `build()` returning structured data, a separate `display()` renderer — `--json` falls out for free, and the structured form is what briefs (08) consume.

## Open questions

1. Time bucketing: by calendar period, by run, or by N-diff windows? Sparse orgs make calendar buckets noisy; tentative: run-indexed with calendar annotations.
2. Where does `praxis status` end and `eval report` begin? Status stays the quick health dashboard (counts, dangling refs, coverage snapshot); eval reports own anything with a denominator or a trend.
3. Export: is `--json` enough for teams piping into their own dashboards, or does a flat CSV per metric earn its place early?
