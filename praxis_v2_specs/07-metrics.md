# 07 — Metrics and Reporting

**Status:** Early draft — capturing conversation output
**Depends on:** all prior docs; this is where their constraints become visible surface

## Hard rules (violating these is a bug, not a style choice)

1. **Coverage and conformance render together, always.** A conformance figure without its coverage denominator is not printed. Rising conformance + falling coverage renders as a warning, not a win.
2. **Every conformance number carries a population qualifier** (01). Unqualified "conformance" does not appear in any output.
3. **Rates over counts, with denominators shown** — violations *per applicable opportunity* (vocabulary), and the opportunity count is displayed, with small-n suppression (02): cells under the floor render as "insufficient data," never as a rate.
4. **Calibration status appears on every report** (06). Stale calibration marks affected numbers uninterpretable.
5. **No cross-species leaderboards** (02): where the optional human/agent contrast exists at all, it renders as per-axiom diagnostic evidence, never as an overall ranking — and only after the unknown-authorship rate is displayed.
6. **Nothing is charted across an epoch boundary** (02). Epochs — maximal intervals of stable spec hashes + judge config — are derived from provenance; boundaries render as named, first-class events ("model → sonnet-4.6", "events spec v3"), and each epoch opens with its baseline. Axiom version changes and removals (04) break that axiom's line the same way.

## Report surfaces

**`praxis eval report [--since <ref>] [--branch] [--json]`** — the eval. Leads with post-spec, within-epoch results:
- Coverage of post-spec diffs (how much new work was visible to any spec — and how much was invisible)
- **Introduction rate per axiom** — the struggle signal (02): flat-while-others-decline is the harness finding
- Violation flow: introduced vs resolved per applicable opportunity (01), against the judge-variance noise floor
- Residual rate (04) and calibration status (06)
- Cost: tokens/dollars per run, per diff, trend
- The human/agent contrast, only where attribution conventions are configured (02), unknown-rate first

**`praxis debt report`** — the baseline and paydown surface (02), honestly named. Debt stock per axiom at baseline, paydown flow since — **attributable per author (git identity of the resolving commit) and per directory**, credit being attributable where blame is not (02) — debt concentration by directory, re-baseline deltas across epoch boundaries. This is where the current `validate all` output migrates.

**`praxis eval report --axiom AX-0007`** — one axiom across everything: rates per population, trend, residual critiques nearby, calibration scores, removal-candidacy signals (03).

## Presentation idiom

Follow the existing v1 pattern (`report-formatter.ts`): pure `build*` functions returning structured data, separate `display*` renderers — `--json` falls out for free, and the structured form is what briefs (08) consume.

## Open questions

1. Time bucketing: by calendar period, by run, or by N-diff windows? Sparse orgs make calendar buckets noisy; tentative: run-indexed with calendar annotations.
2. Where does `praxis status` end and `eval report` begin? Status stays the quick health dashboard (counts, dangling refs, coverage snapshot); eval reports own anything with a denominator or a trend.
3. Export: is `--json` enough for teams piping into their own dashboards, or does a flat CSV per metric earn its place early?
