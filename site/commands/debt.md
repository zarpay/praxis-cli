# praxis debt

Debt is nonconformance in code that predates its spec (or an axiom's `introduced` date): a backlog to burn down — useful, chartable, honestly named, and **categorically not** evidence about agents. Every codebase that adopts praxis begins with its entire history in this state.

## praxis debt report

Per reviewer, over the latest epoch:

- **Baseline → current stock per axiom** — violations (one per axiom+file pair) at the epoch-opening full run versus the latest *evidenced* full run. An all-cache-hit run restates no critiques, so it never moves the evidence anchor; the report prints when each reviewer's stock was last evidenced instead of reading a quiet run as zero debt.
- **Paid down** — in the baseline, gone at latest. **Appeared since baseline** — the reverse, labeled exactly that (per-diff introduction attribution arrives with git diff units).
- **Paydown credit** — when both runs are anchored to commits, the git authors whose commits touched each resolved file between the two shas. Credit is attributable where blame is not: cleanup is deliberate, directed work. Unanchored runs say so instead of guessing.
- **Concentration** — current stock by directory, worst first.
- **Re-baseline deltas** — stock across the last two epochs' baselines, with the boundary named: numbers never cross an epoch boundary as a trend.

Every report carries its calibration status; `--json` emits the built payload verbatim as a stable contract.

## Example

```
[INFO] Debt report — corpus, pre-spec debt included
[WARN] Calibration: uncalibrated — numbers are directional, not interpretable
AX-2559f7 [flash] baseline 3 → current 1 · paid down 2 · appeared since baseline 0
AX-b951db [flash] baseline 5 → current 5 · paid down 0 · appeared since baseline 0

Concentration (current stock by directory):
  src/services: 4
  src/features: 2

Paydown credit:
  Baseline Author — 2 violations resolved
```

The paydown credit names the git authors whose commits touched each resolved file between the two anchored runs — credit is attributable where blame is not: cleanup is deliberate, directed work.
