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
- **Combinations** — `backend/app/events/account_secured_event.rb --no-warns`

**Default: resolve both FAILs and WARNs.** Warnings are real deviations from the spec.

---

## Phase 1 — Discovery

Run validation across the full scope **without** `--fail-fast` to see everything before touching anything:

```bash
# All specs:
praxis eval run

# Scoped to a type:
praxis eval run --type <type>

# Specific files (force fresh review):
praxis eval run <path> --no-cache --verbose
```

Build a numbered checklist of every item to resolve. Do not begin fixing until the full list is in front of you.

---

## Phase 2 — Resolve loop

Work through the checklist one item at a time.

**For each item:**

1. **Read the file** and understand the violation. Use `praxis eval verdict <path> --verbose` to see cached reasoning, or `praxis eval run <path> --verbose` if no cached entry yet.

2. **Fix** — apply the minimum change that satisfies the reported issue. Do not refactor unrelated code.

3. **Verify** — the edit auto-invalidates the cache entry. Run:
   ```bash
   praxis eval run <path>
   ```
   - `✓ PASS` or `⚠ WARN` (when only fixing FAILs) → check off, move to next
   - Still failing → re-read the issue, fix again, verify again
   - Confirmed false positive → note it explicitly, skip, move to next

4. Mark the checklist item done before moving on.

---

## Phase 3 — Final sweep

After all items are addressed, run the full scope once more to confirm no regressions:

```bash
praxis eval run
```

---

## Summary

Report:
- Files resolved and the common violation patterns
- Any WARNs left and why (if `--no-warns` was used)
- False positives encountered — these may indicate the spec needs clarification
