# praxis debt

Debt is nonconformance in code that predates its spec (or an axiom's `introduced` date): a backlog to burn down — useful, chartable, honestly named, and **categorically not** evidence about agents. Every codebase that adopts praxis begins with its entire history in this state.

## praxis debt report

Per reviewer, over the latest epoch:

- **Baseline → current stock per axiom** — violations (one per axiom+file pair) at the epoch-opening full run versus the latest full run.
- **Paid down** — in the baseline, gone at latest. **Appeared since baseline** — the reverse, labeled exactly that (per-diff introduction attribution arrives with git diff units).
- **Paydown credit** — when both runs are anchored to commits, the git authors whose commits touched each resolved file between the two shas. Credit is attributable where blame is not: cleanup is deliberate, directed work. Unanchored runs say so instead of guessing.
- **Concentration** — current stock by directory, worst first.
- **Re-baseline deltas** — stock across the last two epochs' baselines, with the boundary named: numbers never cross an epoch boundary as a trend.

Every report carries its calibration status; `--json` emits the built payload verbatim as a stable contract.
