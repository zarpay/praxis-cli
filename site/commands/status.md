# praxis status

The project health dashboard — no API key, no network, exit 1 on any structural issue so CI can gate on it for free.

## Usage

```bash
praxis status
praxis status --json
```

## What it reports

- **Situational facts** — last run (date and time), and whether an epoch boundary is waiting for a baseline run. Always shown.
- **Knowledge** — authored documents by type plus the active axioms. Only when the spec-layer compiler is in use (the configured experts directory exists).
- **Coverage** — three rows over one denominator, every file under `sources` minus `ignore` (spec files, templates, and the authored taxonomy count on neither side): **observed**, files at least one spec governs; **passing**, the score a CI can rely on — files whose recorded verdict is compliant from every configured reviewer, so unreviewed, warned, and failed files count against it; and **not observed**, the remainder no spec governs. Observed and not observed partition the corpus; passing is the subset of observed that clears. These are the numbers a team maintains the way it maintains test coverage.
- **Verdicts** — pass / warn / fail / not-validated counts per reviewer, read from the committed cache. One row per reviewer, never pooled.
- **Feedback** — the critique lifecycle: every critique on the ledger, and how many are labeled, untriaged, awaiting curation, dismissed, or advisory.
- **Structural issues** — found without any LLM call, compiler projects only: dangling references, orphaned practices, experts missing descriptions, experts that fail to parse, globs matching nothing.

## Example output

```
Praxis Project Status

Last run: 2026-09-03 14:07 UTC

Knowledge
  ┌───────────────┬───────┐
  │ KNOWLEDGE     │ COUNT │
  ├───────────────┼───────┤
  │ Experts       │ 3     │
  │ Practices     │ 3     │
  │ References    │ 1     │
  │ Context files │ 4     │
  │ Axioms        │ 12    │
  └───────────────┴───────┘

Coverage
  ┌──────────────┬───────┬──────┐
  │ COVERAGE     │ FILES │ RATE │
  ├──────────────┼───────┼──────┤
  │ Observed     │ 52/84 │ 62%  │
  │ Passing      │ 40/84 │ 48%  │
  │ Not observed │ 32/84 │ 38%  │
  └──────────────┴───────┴──────┘

Verdicts
  ┌──────────┬──────┬──────┬──────┬───────────────┐
  │ REVIEWER │ PASS │ WARN │ FAIL │ NOT VALIDATED │
  ├──────────┼──────┼──────┼──────┼───────────────┤
  │ mercury  │ 15   │ 2    │ 6    │ 0             │
  │ counter  │ 23   │ 0    │ 0    │ 0             │
  └──────────┴──────┴──────┴──────┴───────────────┘

Feedback
  ┌───────────────────┬───────┐
  │ FEEDBACK          │ COUNT │
  ├───────────────────┼───────┤
  │ Critiques         │ 118   │
  │ Labeled           │ 96    │
  │ Untriaged         │ 11    │
  │ Awaiting curation │ 11    │
  │ Dismissed         │ 0     │
  │ Advisory          │ 0     │
  └───────────────────┴───────┘

[OK] No issues found
```

## Exit code

Exit 1 when any structural issue is found — the same count the closing line prints, so what you read and what CI does can never disagree.

## `--json`: the situational poll

`praxis status --json` is an agent's cheapest situational poll. Alongside the full report, `evalState` answers "what needs doing" in one call:

```json
{
  "evalState": {
    "pending_triage": 11,
    "awaiting_curation": 0,
    "epoch_boundary_detected": false,
    "last_run_at": "2026-09-03T23:21:21.989Z"
  },
  "coverage": {
    "sourceFiles": 84,
    "observed": { "files": 52, "rate": 0.62, "display": "62% (52/84 files)" },
    "passing": { "files": 40, "rate": 0.48, "display": "48% (40/84 files)" }
  },
  "feedback": {
    "critiques": 118,
    "labeled": 96,
    "untriaged": 11,
    "awaitingCuration": 11,
    "dismissed": 0,
    "advisory": 0
  },
  "issueCount": 0
}
```

Bare `praxis` is the same orientation for humans — counts and staleness at a glance, each line naming the command that acts on it.

## Everything without keys

The whole report is a pure read — no API key, no network. Review-state counts come from `.praxis/cache/validation/` (a target shows NOT VALIDATED until something reviews it; run `praxis eval run` to populate the cache), and eval coverage reads spec discovery plus the same cache — observed is accurate before the first run ever happens, and passing climbs as verdicts land.

## See also

- [praxis eval](/commands/eval)
- [Caching](/validation/caching)
- [Configuration](/reference/config)
