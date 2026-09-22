When to use: to re-read what each reviewer last said about a file
without paying for a fresh review.

Behavior:
  Pure cache read — never an API call. One report per configured
  reviewer (reviewers can disagree; they are never pooled). Marked
  STALE when the file, its spec, or its assist context changed since
  the verdict: the verdict then describes inputs that no longer exist,
  and `praxis eval run <target>` refreshes it.

JSON (--json), stable contract:
  [ { reviewer, target, status, stale } ]

Examples:
  $ praxis eval verdict src/services/checkout.ts
  $ praxis eval verdict src/services/checkout.ts --verbose

Next:
  praxis eval run <target>   refresh a stale verdict

Docs: https://zarpay.github.io/praxis-cli/validation/caching
