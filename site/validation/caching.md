# Caching

Every validation result is cached locally. Unchanged documents are never re-validated — only documents whose content or spec has changed since the last run hit the API.

## How the cache works

When `praxis eval run` reviewers a target, each configured reviewer:

1. Computes a content hash over the full review input — `SHA256(targetContent + specContent + assistInputs)`, first 8 characters, where assist inputs are the spec's resolved `exemplars:` and `context:` files
2. Looks up `.praxis/cache/validation/{target-relative-path}.json`
3. If the file holds an entry for this (spec, reviewer) pair and the hash matches — returns the cached verdict without any API call
4. If there is no entry, or the hash doesn't match — calls the API and writes the verdict

The hash covers everything the reviewer saw. If the target, the spec, an exemplar, or a context file changes, the cached verdict is automatically invalidated and the target is re-evaluated on the next run. Cohort units hash the assembled member set, so editing any member invalidates the cohort's verdict.

## Cache file structure

Each target has exactly one cache file at `.praxis/cache/validation/{target-relative-path}.json` — its complete review state in one committed artifact.

The file contains a `verdicts` map keyed by `<specHash>:<reviewerHash>`: an 8-char hash of the spec's relative path, plus the reviewer's behavioral hash (its config minus `name`/`apiKeyEnvVar`, plus the system prompt). One file can therefore hold verdicts from multiple specs and multiple reviewers side by side:

```json
{
  "version": "3.0",
  "verdicts": {
    "a1b2c3d4:f83a92f1": {
      "reviewer": {
        "name": "flash",
        "model": "deepseek/deepseek-v4-flash-0731",
        "hash": "f83a92f1"
      },
      "spec_path": "experts/README.md",
      "cached_at": "2026-08-31T14:30:45.123Z",
      "content_hash": "abcd1234",
      "context_files": [{ "path": "src/domain/types.ts", "hash": "f1d20738" }],
      "result": {
        "compliant": true,
        "issues": [],
        "reason": "The document meets all requirements."
      }
    }
  }
}
```

When the spec declares `exemplars:` or `context:`, the entry records the resolved files with per-file content hashes (`exemplar_files` / `context_files`) — the exact inputs behind the verdict.

## Cache invalidation

The cache invalidates automatically when:

- The target content changes (any member, for cohort units)
- The spec file content changes
- An exemplar or context file the spec declares changes
- The reviewer's behavioral settings change (model, temperature, baseUrl) — this invalidates all of that reviewer's entries at once

Renaming a reviewer does _not_ invalidate anything: the name is excluded from the reviewer hash, so identity follows behavior, not the label. Rolling a config change back re-hits the old entries at zero cost. There is no manual cache management needed in normal use.

## Disabling the cache

Pass `--no-cache` to any `eval` subcommand to skip cache reads and writes:

```bash
praxis eval run --no-cache
praxis eval run experts/my-expert.md --no-cache
```

This is useful when you want to force re-validation for debugging or after a significant spec rewrite.

## Cache hit reporting

When running with a cache enabled, `praxis eval run` reports cache statistics at the end:

```
[CACHE] Hits: 9, Misses: 3
```

This tells you how many documents were served from cache vs. how many required an API call.

## Reading stale cache

`praxis eval verdict` reads the cache without requiring a content hash match. This lets you inspect a document's last known validation status even if the document has changed since then. A changed document is reported as **STALE** rather than **NOT VALIDATED**.

## Committing the cache

The cache lives at `.praxis/cache/validation/`. Whether to commit it depends on your workflow:

- **Commit it** if you want CI to get cache hits on unchanged documents and only pay for changed ones.
- **Ignore it** if you prefer every CI run to be a full re-validation.

If you commit the cache, add it to a gitignore pattern if you want build artifacts excluded, or track it explicitly. There is no wrong answer.

## See also

- [praxis eval run](/commands/eval)
- [Validation Domains](/concepts/validation-domains)
- [CI Integration](/validation/ci)
