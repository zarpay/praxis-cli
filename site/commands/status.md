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
- **Coverage** — three rows over one denominator, every file under `sources` minus `ignore` (spec files, templates, and the authored taxonomy count on neither side): **observed**, files at least one spec governs; **passing**, the score a CI can rely on — files whose recorded verdict is compliant from every configured reviewer, so unreviewed, warned, and failed files count against it; and **not observed**, the remainder no spec governs. Observed and not observed partition the corpus; passing is the subset of observed that clears. A fourth row, **passing of observed**, puts that same passing count over the observed files instead of the corpus, so you can read how much of what the specs cover currently clears, apart from how much they cover. Every rate prints to two decimals. These are the numbers a team maintains the way it maintains test coverage.
- **Verdicts** — pass / warn / fail / not-validated counts per reviewer, read from the committed cache. One row per reviewer, never pooled.
- **Feedback** — the critique lifecycle: every critique on the ledger, and how many are labeled, untriaged, awaiting curation, dismissed, or advisory.
- **Structural issues** — found without any LLM call, compiler projects only: dangling references, orphaned practices, experts missing descriptions, experts that fail to parse, globs matching nothing.

## Example output

```

Praxis Project Status

Last run: 2026-10-06 11:39 UTC


Knowledge
  ┌───────────────┬───────┐
  │ KNOWLEDGE     │ COUNT │
  ├───────────────┼───────┤
  │ Experts       │ 3     │
  │ Practices     │ 3     │
  │ References    │ 1     │
  │ Context files │ 4     │
  │ Axioms        │ 16    │
  └───────────────┴───────┘


Coverage
  ┌─────────────────────┬───────┬────────┐
  │ COVERAGE            │ FILES │ RATE   │
  ├─────────────────────┼───────┼────────┤
  │ Observed            │ 29/38 │ 76.32% │
  │ Passing             │ 22/38 │ 57.89% │
  │ Not observed        │ 9/38  │ 23.68% │
  │ Passing of observed │ 22/29 │ 75.86% │
  └─────────────────────┴───────┴────────┘


Verdicts
  ┌──────────┬──────┬──────┬──────┬───────────────┐
  │ REVIEWER │ PASS │ WARN │ FAIL │ NOT VALIDATED │
  ├──────────┼──────┼──────┼──────┼───────────────┤
  │ mercury  │ 17   │ 0    │ 6    │ 0             │
  │ counter  │ 23   │ 0    │ 0    │ 0             │
  └──────────┴──────┴──────┴──────┴───────────────┘


Feedback
  ┌───────────────────┬───────┐
  │ FEEDBACK          │ COUNT │
  ├───────────────────┼───────┤
  │ Critiques         │ 320   │
  │ Labeled           │ 235   │
  │ Untriaged         │ 76    │
  │ Awaiting curation │ 5     │
  │ Dismissed         │ 1     │
  │ Advisory          │ 3     │
  └───────────────────┴───────┘

[OK] No issues found
```

## Exit code

Exit 1 when any structural issue is found — the same count the closing line prints, so what you read and what CI does can never disagree.

## `--json`: the situational poll

`praxis status --json` is an agent's cheapest situational poll — the whole report as one object, structural issues included. `evalState` is the part that answers "what needs doing" in one call:

```json
{
  "compilerInUse": true,
  "counts": {
    "experts": 3,
    "practices": 3,
    "references": 1,
    "context": 4,
    "axioms": 16
  },
  "validation": [
    {
      "reviewer": "mercury",
      "pass": 17,
      "warn": 0,
      "fail": 6,
      "notValidated": 0
    },
    {
      "reviewer": "counter",
      "pass": 23,
      "warn": 0,
      "fail": 0,
      "notValidated": 0
    }
  ],
  "evalState": {
    "pending_triage": 76,
    "awaiting_curation": 5,
    "epoch_boundary_detected": false,
    "last_run_at": "2026-10-06T11:53:18.345Z"
  },
  "coverage": {
    "sourceFiles": 38,
    "observed": {
      "files": 29,
      "rate": 0.7631578947368421,
      "display": "76.32% (29/38 files)"
    },
    "passing": {
      "files": 22,
      "rate": 0.5789473684210527,
      "display": "57.89% (22/38 files)"
    },
    "passingOfObserved": {
      "files": 22,
      "rate": 0.7586206896551724,
      "display": "75.86% (22/29 observed files)"
    }
  },
  "feedback": {
    "critiques": 320,
    "labeled": 235,
    "untriaged": 76,
    "awaitingCuration": 5,
    "dismissed": 1,
    "advisory": 3
  },
  "issueCount": 0,
  "orphanedPractices": [],
  "danglingRefs": [],
  "expertsMissingDescription": [],
  "invalidExperts": [],
  "zeroMatchGlobs": []
}
```

`counts` and `validation` carry the Knowledge and Verdicts tables; `coverage` and `feedback` carry theirs. The five arrays — `orphanedPractices`, `danglingRefs`, `expertsMissingDescription`, `invalidExperts`, `zeroMatchGlobs` — are the structural issues, each empty on a healthy project, and `issueCount` is their total: the number the exit code follows.

Bare `praxis` is the same orientation for humans — counts and staleness at a glance, each line naming the command that acts on it. It takes `--json` too, and is the smaller poll of the two: the queues and the debt line, without the structural report.

```json
{
  "lastRun": { "at": "2026-10-06T11:56:36.448Z", "reviewerName": "counter", "anchored": true },
  "pendingTriage": 76,
  "awaitingCuration": 5,
  "activeAxioms": 16,
  "debtLine": [
    { "reviewerName": "counter", "errors": 0 },
    { "reviewerName": "mercury", "errors": 6 }
  ]
}
```

`lastRun` is `null` before the first run, and `anchored` reports whether that run was tied to a commit — an unanchored run is feedback, not measurement.

## Everything without keys

The whole report is a pure read — no API key, no network. Review-state counts come from `.praxis/cache/validation/` (a target shows NOT VALIDATED until something reviews it; run `praxis eval run` to populate the cache), and eval coverage reads spec discovery plus the same cache — observed is accurate before the first run ever happens, and passing climbs as verdicts land.

## See also

- [praxis eval](/commands/eval)
- [Caching](/validation/caching)
- [Configuration](/reference/config)
