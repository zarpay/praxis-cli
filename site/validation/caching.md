# Caching

Every validation result is cached locally. Unchanged documents are never re-validated — only documents whose content or spec has changed since the last run hit the API.

## How the cache works

When `praxis validate` validates a document, it:

1. Computes a content hash: `SHA256(documentContent + specContent)`, first 8 characters
2. Looks up `.praxis/cache/validation/{doc-relative-path}.json`
3. If a cache entry exists for this (document, spec) pair and the hash matches — returns the cached result without any API call
4. If there is no entry, or the hash doesn't match — calls the API and writes the result to cache

The hash covers both the document and the spec. If either one changes, the cached result is automatically invalidated and the document is re-validated on the next run.

## Cache file structure

Each document has a single cache file at `.praxis/cache/validation/{source-dir}/{docname}.json`.

The file contains a `validations` map keyed by an 8-char hash of the spec's relative path. This allows a document that is validated by multiple specs to store all results independently in one file:

```json
{
  "version": "2.0",
  "validations": {
    "a1b2c3d4": {
      "spec_path": "roles/README.md",
      "cached_at": "2025-05-27T14:30:45.123Z",
      "content_hash": "abcd1234",
      "result": {
        "compliant": true,
        "issues": [],
        "reason": "Yes — the document meets all requirements."
      }
    }
  }
}
```

## Cache invalidation

The cache invalidates automatically when:

- The document content changes
- The spec file content changes

There is no manual cache management needed in normal use.

## Disabling the cache

Pass `--no-cache` to any `validate` subcommand to skip cache reads and writes:

```bash
praxis validate all --no-cache
praxis validate document roles/my-role.md --no-cache
```

This is useful when you want to force re-validation for debugging or after a significant spec rewrite.

## Cache hit reporting

When running with a cache enabled, `praxis validate all` reports cache statistics at the end:

```
[CACHE] Hits: 9, Misses: 3
```

This tells you how many documents were served from cache vs. how many required an API call.

## Reading stale cache

`praxis validate report` reads the cache without requiring a content hash match. This lets you inspect a document's last known validation status even if the document has changed since then. A changed document is reported as **STALE** rather than **NOT VALIDATED**.

## Committing the cache

The cache lives at `.praxis/cache/validation/`. Whether to commit it depends on your workflow:

- **Commit it** if you want CI to get cache hits on unchanged documents and only pay for changed ones.
- **Ignore it** if you prefer every CI run to be a full re-validation.

If you commit the cache, add it to a gitignore pattern if you want build artifacts excluded, or track it explicitly. There is no wrong answer.

## See also

- [praxis validate](/commands/validate)
- [Validation Domains](/concepts/validation-domains)
- [CI Integration](/validation/ci)
