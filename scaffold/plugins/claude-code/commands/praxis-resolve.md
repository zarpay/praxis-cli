---
description: Iteratively resolve Praxis spec violations — review, fix, and verify until all targeted files are compliant.
---

Work through Praxis spec violations one at a time: discover the full scope first, fix each file, verify it passes, move on.

## Arguments

`$ARGUMENTS` accepts any combination of:

- **Empty** — resolve all specs, FAILs and WARNs (default)
- **`--no-warns`** — resolve FAILs only, leave WARNs
- **`--warns-only`** — resolve WARNs only, skip FAILs
- **Type filter** — a `--type` label from the "By type:" summary (e.g. `.claude/agents`)
- **File paths** — one or more specific files
- **Combinations** — `path/to/file.rb --no-warns`

**Default: resolve both FAILs and WARNs.** Warnings are real deviations from the spec.

---

## Phase 1 — Discovery

Run validation across the full scope **without** `--fail-fast` to see everything before touching anything:

```bash
praxis validate all
praxis validate all --type <type>
praxis validate document <path> --no-cache --verbose
```

Build a numbered checklist of every item to resolve. Do not begin fixing until the full list is in front of you.

---

## Phase 2 — Resolve loop

For each item in the checklist:

1. **Read** — use `praxis validate report <path> --verbose` for cached reasoning, or `praxis validate document <path> --verbose` if no cache entry.
2. **Fix** — minimum change satisfying the reported issue. No unrelated edits.
3. **Verify** — the edit auto-invalidates the cache. Run `praxis validate document <path>`.
   - PASS/WARN (when fixing FAILs only) → check off, next
   - Still failing → fix again, verify again
   - Confirmed false positive → note it, skip, next
4. Mark done before moving on.

---

## Phase 3 — Final sweep

```bash
praxis validate all
```

Confirm no regressions across the full scope.

---

## Summary

Report files resolved, common patterns, WARNs left and why, and any false positives that suggest the spec needs clarification.
