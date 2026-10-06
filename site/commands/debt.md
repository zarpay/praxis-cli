# praxis debt

Debt is nonconformance in code that predates its spec (or an axiom's `introduced` date): a backlog to burn down — useful, chartable, honestly named, and **categorically not** evidence about agents. Every codebase that adopts praxis begins with its entire history in this state.

## praxis debt report

Per reviewer, over the latest epoch:

- **Baseline → current stock per axiom** — violations (one per axiom+file pair) at the epoch-opening full run versus the latest *evidenced* full run. An all-cache-hit run restates no critiques, so it never moves the evidence anchor; the report prints when each reviewer's stock was last evidenced instead of reading a quiet run as zero debt.
- **Paid down** — in the baseline, gone at latest. **Appeared since baseline** — the reverse, labeled exactly that (per-diff introduction attribution arrives with git diff units).
- **Paydown credit** — when both runs are anchored to commits, the git authors whose commits touched each resolved file between the two shas. Credit is attributable where blame is not: cleanup is deliberate, directed work. Unanchored runs say so instead of guessing.
- **Concentration** — current stock by directory, worst first.
- **Re-baseline deltas** — stock across the last two epochs' baselines, with the boundary named: numbers never cross an epoch boundary as a trend.

`--json` emits the built payload verbatim as a stable contract, one key per section of the printed report:

| Key | Shape |
| --- | --- |
| `evidence` | One entry per reviewer: `{ reviewerName, baselineAt, currentAt }` — the freshness panel. `currentAt` is the last *evidenced* run, so an all-hit run never moves it |
| `rows` | The per-axiom stock table: `{ axiomId, statement, reviewerName, baselineStock, currentStock, appearedSinceBaseline, paydown }`, one row per (axiom, reviewer) — never pooled |
| `concentration` | `{ directory, violations }`, current stock by directory |
| `credits` | `{ author, resolved }`, paydown credit by git author; empty when it cannot be attributed |
| `creditNote` | Why credit is unavailable, or `null` when it is |
| `rebaseline` | `{ boundaryLabel, before, after }` — the deltas across an epoch boundary |

## Example

```
Debt report — corpus, pre-spec debt included

Evidence freshness — when each reviewer's stock was measured. An
all-hit run re-evidences nothing, so a stale date means unmeasured
since then, never clean:
  flash: baseline 2026-09-08 · last evidenced 2026-09-08
  v32: baseline 2026-09-08 · last evidenced 2026-09-08

Stock by axiom (baseline → current, one row per reviewer):
  ┌───────────┬──────────┬──────────┬──────────┬───────────┬─────────┐
  │ AXIOM     │ REVIEWER │ BASELINE │ APPEARED │ PAID DOWN │ CURRENT │
  ├───────────┼──────────┼──────────┼──────────┼───────────┼─────────┤
  │ AX-2559f7 │ flash    │ 3        │ 0        │ 2         │ 1       │
  │ AX-b951db │ flash    │ 5        │ 0        │ 0         │ 5       │
  └───────────┴──────────┴──────────┴──────────┴───────────┴─────────┘

Concentration (current stock by directory):
  ┌──────────────┬───────┐
  │ DIRECTORY    │ STOCK │
  ├──────────────┼───────┤
  │ src/services │ 4     │
  │ src/features │ 2     │
  └──────────────┴───────┘

Paydown credit (authors of resolving commits):
  ┌─────────────────┬──────────┐
  │ AUTHOR          │ RESOLVED │
  ├─────────────────┼──────────┤
  │ Baseline Author │ 2        │
  └─────────────────┴──────────┘
```

The paydown credit names the git authors whose commits touched each resolved file between the two anchored runs — credit is attributable where blame is not: cleanup is deliberate, directed work.
