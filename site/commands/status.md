# praxis status

The project health dashboard — no API key, no network, exit 1 on any structural issue so CI can gate on it for free.

## Usage

```bash
praxis status
praxis status --json
```

## What it reports

- **Situational facts** — last run, pending triage count, proposals awaiting ratification, and whether an epoch boundary is waiting for a baseline run. Always shown.
- **Review coverage** — pass / warn / fail / not-validated counts per reviewer, read from the committed cache. One block per reviewer, never pooled.
- **Document counts** — only when the spec-layer compiler is in use (the configured experts directory exists).
- **Structural issues** — found without any LLM call, compiler projects only: dangling references, orphaned practices, experts missing descriptions, experts that fail to parse, globs matching nothing.

## Example output

```
[INFO] Praxis Project Status

Last run: 2026-09-03 · Pending triage: 11 · Proposals awaiting ratification: 0

  Experts:          3
  Practices:        3
  References:       1
  Context files:    4

[INFO] Validation (reviewer: flash)
  [PASS] 15
  [WARN] 1
  [FAIL] 2
  [NOT VALIDATED] 0

[INFO] Validation (reviewer: v32)
  [PASS] 14
  [WARN] 0
  [FAIL] 4
  [NOT VALIDATED] 0

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
    "proposals_pending": 0,
    "calibration_stale": true,
    "epoch_boundary_detected": false,
    "last_run_at": "2026-09-03T23:21:21.989Z"
  },
  "issueCount": 0
}
```

Bare `praxis` is the same orientation for humans — counts and staleness at a glance, each line naming the command that acts on it.

## Coverage without keys

Coverage counts are read from `.praxis/cache/validation/` — no API key, no network. A target shows NOT VALIDATED when nothing has reviewed it yet. Run `praxis eval run` to populate the cache; from then on `status` tracks it.

## See also

- [praxis eval](/commands/eval)
- [Caching](/validation/caching)
- [Configuration](/reference/config)
