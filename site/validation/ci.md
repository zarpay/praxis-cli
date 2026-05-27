# CI Integration

`praxis validate ci` is designed for pull request pipelines. It validates all documents, reports a summary, and exits with a code that your CI system can act on.

## Basic setup

Add a step to your CI workflow after checkout:

```yaml
- name: Validate Praxis documents
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: praxis validate ci
```

Exit code 0 means all documents passed (or had only warnings). Exit code 1 means at least one document has a hard error.

## Strict mode

Fail on warnings as well as errors:

```bash
praxis validate ci --strict
```

Use this if your team treats spec warnings as blocking — for example, in a repository where every document must be fully compliant before merge.

## Using the cache in CI

If you commit `.praxis/cache/validation/` to the repository, CI gets cache hits on every unchanged document. Only documents that changed in the pull request hit the API.

This dramatically reduces API usage on large repositories where most documents don't change in any given PR.

If you don't commit the cache, every CI run validates everything from scratch.

## GitHub Actions example

```yaml
name: Validate Knowledge

on:
  pull_request:
    paths:
      - 'roles/**'
      - 'responsibilities/**'
      - 'reference/**'
      - 'context/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Praxis
        run: npm install -g @zarpay/praxis-cli

      - name: Validate documents
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: praxis validate ci --strict
```

The `paths` filter on the trigger means this workflow only runs when knowledge documents change — not on every PR.

## Checking project health without validation

`praxis status` exits with code 1 if there are structural issues (dangling references, orphaned responsibilities, missing required frontmatter fields). It does not require an API key, so it can run cheaply on every PR:

```yaml
- name: Check project health
  run: praxis status
```

Use `praxis status` as a fast first check and `praxis validate ci` as the deeper LLM-backed check.

## Managing API costs

A few practices that help keep validation costs predictable:

- **Commit the cache** — unchanged documents are free.
- **Use `paths` triggers** — only validate when knowledge files change.
- **Use `--type` to scope** — if only roles changed, `praxis validate all --type roles` avoids re-validating everything.
- **Pick an efficient model** — the default `x-ai/grok-4.1-fast` is tuned for speed and cost. Swap for a larger model if you need more nuanced judgment on complex specs.

## See also

- [praxis validate](/commands/validate)
- [Caching](/validation/caching)
- [praxis status](/commands/status)
