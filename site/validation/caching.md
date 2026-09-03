# Caching

Every verdict is cached. Unchanged targets are never re-reviewed — only files whose review input has changed since the last run cost an API call.

## How the cache works

When `praxis eval run` reviews a target, each configured reviewer:

1. Computes a content hash over the **full review input** — the target, the spec, the spec's resolved `exemplars:` and `context:` files, and the active axiom checklist
2. Looks up `.praxis/cache/validation/{target-relative-path}.json`
3. If the file holds an entry for this (spec, reviewer) pair and the hash matches — returns the cached verdict without any API call
4. If there is no entry, or the hash doesn't match — calls the provider and writes the verdict

The hash covers everything the reviewer saw. Editing the target, the spec, an exemplar, a context file — or ratifying an axiom grounded in the spec — invalidates exactly the verdicts those inputs produced. Cohort units hash the assembled member set, so editing any member invalidates the cohort's verdict.

## Cache file structure

Each target has exactly one cache file — its complete review state, across all specs and all reviewers, in one committed artifact. Entries are keyed `<specHash>:<reviewerHash>`:

```json
{
  "version": "5.0",
  "verdicts": {
    "a1b2c3d4:f83a92f1": {
      "reviewer": {
        "name": "flash",
        "model": "deepseek/deepseek-v4-flash-0731",
        "hash": "f83a92f1"
      },
      "spec_path": "src/services/README.md",
      "cached_at": "2026-09-02T14:30:45.123Z",
      "content_hash": "abcd1234",
      "exemplar_files": [{ "path": "src/services/create-review.ts", "hash": "f1d20738" }],
      "result": {
        "compliant": false,
        "severity": "error",
        "issues": [
          {
            "text": "Error message 'bad input' names nothing.",
            "axiomId": "AX-b951db",
            "axiomVersion": 1
          }
        ],
        "reason": "The service violates the error-message standard."
      }
    }
  }
}
```

The reviewer's hash is its **behavioral identity**: the whole config entry minus `name` and `apiKeyEnvVar`, plus the complete reviewer-facing prompt surface this praxis version ships. When the spec declares `exemplars:` or `context:`, the entry records the resolved files with per-file hashes — the exact inputs behind the verdict.

## Cache invalidation

The cache invalidates automatically when:

- The target content changes (any member, for cohort units)
- The spec file content changes
- An exemplar or context file the spec declares changes
- An axiom grounded in the spec is ratified, versioned, or deprecated — the checklist is part of what the reviewer is asked
- The reviewer's behavioral settings change (model, temperature, baseUrl, provider, options) — this rolls the reviewer's [epoch](/concepts/evidence-loop) and invalidates all of its entries at once

Renaming a reviewer does *not* invalidate anything: the name is excluded from the hash, so identity follows behavior, not the label. Rolling a config change back re-hits the old entries at zero cost. There is no manual cache management in normal use — `praxis eval prune` exists only to drop entries no configured reviewer can ever hit again.

## Disabling the cache

Pass `--no-cache` to skip cache reads and writes:

```bash
praxis eval run --no-cache
praxis eval run src/services/redeem-coupon.ts --no-cache
```

Useful for checking reviewer non-determinism on a borderline result.

## Cache hit reporting

Every cached run ends with the tally, and the run record in the ledger carries the same numbers:

```
[CACHE] Hits: 17, Misses: 1
```

## Reading a stale entry

`praxis eval verdict <path>` reads the cache without requiring a hash match, so you can inspect a target's last known verdict even after editing it. A changed target reports **STALE** rather than **NOT VALIDATED**.

## Commit the cache

`.praxis/` is committed — the ledger requires it, and the cache pays for itself the moment a second machine is involved: a verdict paid for on your laptop is a cache hit in CI and on every teammate's clone. Cache files are deterministic per content, so merges are rare and trivial.

## See also

- [praxis eval](/commands/eval)
- [The Evidence Loop](/concepts/evidence-loop)
- [CI Integration](/validation/ci)
