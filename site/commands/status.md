# praxis status

The project health dashboard — no API key, no network, exit 1 on any structural issue so CI can gate on it for free.

## Usage

```bash
praxis status
praxis status --json
```

## What it reports

- **Situational facts** — last run, the untriaged and awaiting-curation queue counts, eval coverage, and whether an epoch boundary is waiting for a baseline run. Always shown.
- **Eval coverage** — the share of source files at least one spec governs: governed files over every file under `sources` minus `ignore` (spec files, templates, and the authored taxonomy count on neither side). This is the number a team maintains the way it maintains test coverage.
- **Review state** — pass / warn / fail / not-validated counts per reviewer, read from the committed cache. One block per reviewer, never pooled.
- **Document counts** — only when the spec-layer compiler is in use (the configured experts directory exists).
- **Structural issues** — found without any LLM call, compiler projects only: dangling references, orphaned practices, experts missing descriptions, experts that fail to parse, globs matching nothing.

## Example output

```
Praxis Project Status

Last run: 2026-09-03
Untriaged: 11 · Awaiting curation: 0
Eval coverage: 62% (52/84 files)

  Experts:            3
  Practices:          3
  References:         1
  Context files:      4

Validation (reviewer: mercury)
  ● 15 pass   ● 2 warn   ● 6 fail   ● 0 not validated

Validation (reviewer: counter)
  ● 23 pass   ● 0 warn   ● 0 fail   ● 0 not validated

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
    "calibration_stale": true,
    "epoch_boundary_detected": false,
    "last_run_at": "2026-09-03T23:21:21.989Z"
  },
  "coverage": {
    "governed": 52,
    "sourceFiles": 84,
    "rate": 0.62,
    "display": "62% (52/84 files)"
  },
  "issueCount": 0
}
```

Bare `praxis` is the same orientation for humans — counts and staleness at a glance, each line naming the command that acts on it.

## Everything without keys

The whole report is a pure read — no API key, no network. Review-state counts come from `.praxis/cache/validation/` (a target shows NOT VALIDATED until something reviews it; run `praxis eval run` to populate the cache), and eval coverage comes from spec discovery alone, so it is accurate before the first run ever happens.

## See also

- [praxis eval](/commands/eval)
- [Caching](/validation/caching)
- [Configuration](/reference/config)
