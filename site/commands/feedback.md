# praxis feedback

Review for the person writing the code, not for the record.

```bash
praxis feedback src/services/checkout.ts
praxis feedback src/services --reviewer mercury
praxis feedback src/services/checkout.ts --json
```

Same reviewers, same specs, same prose you would get from [`praxis eval run`](/commands/eval). The difference is what happens afterwards: **its critiques never enter triage or curate, and never reach a report.** They describe code in flight, not code that landed.

| Flag | Description |
| ------------------- | ------------------------------------------------------------- |
| `--reviewer <name>` | Run only the named reviewer (default: all configured reviewers) |
| `--verbose` | Print the full AI reasoning after the result |
| `--no-cache` | Skip the cache and always call the API |
| `--json` | Machine-readable outcome on stdout |

**Exit code:** always 0. This is advice, not a gate — a build must not fail because a developer asked a question.

## Why it exists

A team using the fast loop the way it is meant to be used generates critiques constantly, about files that are half-written and will be edited again in a minute. Recorded as evidence, that buries the critiques that describe code which actually shipped, and somebody has to triage all of it to find them.

So feedback is recorded but never queued:

| | printed | ledger run + cost | critiques recorded | triage / curate | reports |
| ------------------------ | ------- | ----------------- | ------------------ | --------------- | ------- |
| `praxis feedback` | ✓ | ✓ | ✓ | **never** | never |
| `praxis eval run <file>` | ✓ | ✓ | ✓ | ✓ | — |
| `praxis eval run` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `praxis eval ci` | ✓ | — | — | — | — |

The run is stamped `scope: "advisory"` in the ledger, with its full cost. Nothing is hidden — `praxis eval critiques` still lists what the reviewers said, and the spend shows up in the ledger like any other run. What changes is that no queue offers it to a human.

## It never writes the cache

A cache hit writes no critique record, because nothing new was reviewed. So if feedback populated the verdict cache, this would happen: you ask about a file, the reviewer finds something real, you leave the code as it is, and the next corpus or PR run **hits the cache** and records no critique. The issue would never reach triage, and nothing would say why.

Feedback therefore reads the cache and never writes it. A file already reviewed by a corpus run answers instantly and free; a file you have just edited misses, pays, prints, and leaves the cache untouched so the next real run does its own call and records what it finds.

## Targets resolve to units

You name a path; the specs decide what the reviewable thing is.

| You name | Reviewed |
| ------------------------------------ | ------------------------------------- |
| a file under a `by_file` spec | that file |
| a file inside a `cohort: by_directory` | **the whole cohort directory** |
| a cohort directory | that cohort |
| a directory of `by_file` files | every governed file beneath it |

The cohort case is deliberate: the cohort is the unit its spec judges, and reviewing one member alone would answer a question the spec never asks. The command prints which units it resolved to, so it is visible rather than surprising.

A path no expert covers — unmatched by every spec's `paths:`, or shielded by one's `excludes:` — is refused with a message saying so, because there is no standard to give feedback against. This differs from `eval run <file>`, which reviews an excluded file on explicit ask; feedback declines, since "we do not hold this to the standard" and "here is how it measures against the standard" cannot both be true.
