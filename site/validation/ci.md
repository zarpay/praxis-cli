# CI Integration

`praxis eval ci` is the merge gate: a full review of everything the specs govern, framed for a pipeline. It exits 0 when the branch is clean and 1 when it isn't — and it **verifies without writing the ledger**. The branch's own committed runs are the evidence; CI just checks them.

## Basic setup

```yaml
- name: Review against specs
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: praxis eval ci
```

Exit 0: no errors. Exit 1: at least one error verdict — or any target that could not be reviewed at all (**UNVERIFIED**): a gate that could not look is not a gate, so an unreadable file or an oversized cohort fails CI rather than passing unseen.

## Strict mode

```bash
praxis eval ci --strict
```

Fails on warnings as well as errors — for repositories where "should" is treated as "must" at merge time.

## The cache makes it cheap

Because `.praxis/cache/` is committed, CI gets a cache hit on every target unchanged by the pull request. A PR that touches one service re-reviews one service; everything else is free. On Scoop Society, a typical PR run reads:

```
[CACHE] Hits: 17, Misses: 1
```

## GitHub Actions example

```yaml
name: Praxis review

on:
  pull_request:

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Praxis
        run: npm install -g @zarpay/praxis-cli

      - name: Structural health (no API key needed)
        run: praxis status

      - name: Review against specs
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: praxis eval ci --strict
```

`praxis status` runs first as the free check: it exits 1 on structural issues (dangling references, orphaned practices, unparseable experts) without any LLM call. `eval ci` is the deeper, judgment-backed gate.

## Evidence-grade runs, free

Praxis never creates commits — anchoring evidence to a commit is the workflow's job. CI is where that comes free: a checkout is always a clean tree on a known sha, so runs made there are fully reconstructable. If you want archive-grade evidence on every change, run `praxis eval run` (which *does* write the ledger) from a post-merge workflow and commit the `.praxis/` delta.

## Managing API costs

- **Commit the cache** — unchanged targets are free, everywhere.
- **Use `--type` to scope local runs** — `praxis eval run --type src/services` reviews one domain.
- **Let the fast loop pay down misses before CI** — `praxis eval run <file>` after each fix means CI sees hits.
- **Pick reviewers deliberately** — a fast, cheap model catches most drift; add a stronger second reviewer where disagreement is informative.

## See also

- [praxis eval](/commands/eval)
- [Caching](/validation/caching)
- [praxis status](/commands/status)
