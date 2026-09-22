When to use: to read the evidence — per-axiom violation rates with
their denominators, epochs, violation flow, costs.

Behavior:
  Pure read over the ledger and read-only git; never calls a reviewer.
  Three scope levels: files (a path or glob argument), one commit
  (--commit), or a PR's set (--commits); --since takes an ISO date or a
  git ref whose commit date is used. Every rate renders with its
  denominator, cells under the small-n floor (n=5) say so instead of
  showing a rate, reviewers are never pooled, and trends are never
  charted across an epoch boundary — boundaries print as named lines.

JSON (--json), stable contract:
  { scope { target, since, branch, commits, unresolvableShas },
    panel { runs, critiques, filesTouched, reviewers, specs, costUsd,
            elapsedMs, costTrend },
    calibration,
    axioms: [ { axiomId, statement, severity, reviewerName,
                rate { numerator, denominator, rate, display },
                asOf, files, byPopulation, segments } ],
    pendingTriage, awaitingCuration, residual, epochs }

Examples:
  $ praxis eval report                    # current epoch, everything
  $ praxis eval report --axiom AX-b951db  # one category, drilled down
  $ praxis eval report --branch feature/x --since v1.4.0
  $ praxis eval report --commits abc123 def456   # a PR's runs

Next:
  praxis axioms show <id>   a row's category in full
  praxis debt report        the pre-spec backlog and its paydown

Docs: https://zarpay.github.io/praxis-cli/commands/eval
