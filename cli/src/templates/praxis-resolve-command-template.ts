/**
 * The /praxis-resolve slash command written into user projects: an
 * agent-facing prompt that works through spec violations one file at
 * a time — discover, fix, verify — until the project is compliant.
 */
export default function praxisResolveCommandTemplate(): string {
  return `---
description: Iteratively resolve Praxis spec violations — review, fix, and verify until all targeted files are compliant.
---

Work through Praxis spec violations one at a time: discover the full scope first, fix each file, verify it passes, move on.

## Arguments

\`$ARGUMENTS\` accepts any combination of:

- **Empty** — resolve all specs, FAILs and WARNs (default)
- **\`--no-warns\`** — resolve FAILs only, leave WARNs
- **\`--warns-only\`** — resolve WARNs only, skip FAILs
- **Type filter** — a \`--type\` label from the "By type:" summary (e.g. \`.claude/agents\`)
- **File paths** — one or more specific files
- **Combinations** — \`backend/app/events/account_secured_event.rb --no-warns\`

**Default: resolve both FAILs and WARNs.** Warnings are real deviations from the spec.

## Phase 1 — Discovery

See everything before touching anything. Run without \`--fail-fast\`:

\`\`\`bash
praxis eval run                  # all specs
praxis eval run --type <type>    # one type
praxis eval run <path> <path>    # named files
\`\`\`

\`eval run\` takes files, not directories — for a whole directory, pass a glob: \`praxis eval run "backend/app/events/*"\`.

Build a numbered checklist of every finding. Do not begin fixing until the full list is in front of you.

## Phase 2 — Resolve loop

Work the checklist one item at a time.

1. **Understand the finding.** \`praxis eval verdict <path> --verbose\` replays the reviewer's full reasoning from the cache, with no API call. A finding citing \`[AX-xxxxxx]\` names a standard — \`praxis axioms show <id>\` gives its statement and the critiques behind it.

2. **Fix** — the minimum change that satisfies the finding. Do not refactor unrelated code.

3. **Verify** — the edit auto-invalidates the cache entry:
   \`\`\`bash
   praxis eval run <path>
   \`\`\`
   - \`✓ PASS\`, or \`⚠ WARN\` when only FAILs are in scope → check it off
   - Still failing → iterate with \`praxis feedback <path>\`: the same reviewers, but its critiques never enter the triage queue, because a half-fixed file is not evidence. It writes no cache entry, so run \`praxis eval run <path>\` once more when feedback comes back clean.
   - A false positive → dismiss it on the record, don't skip it (below)

4. Mark the item done before moving on.

### False positives

A finding the spec does not actually support is dismissed, not left sitting in the queue:

\`\`\`bash
praxis eval critiques <path> --state untriaged                  # the ids
praxis eval review --dismiss <id> <id> --reason "why it is wrong"
\`\`\`

The dismissal rate is the reviewer-trust signal: a run of them means the spec and the humans disagree, and the spec is what needs the edit.

## Phase 3 — Final sweep

\`\`\`bash
praxis eval run
\`\`\`

Unchanged files come back from the cache, so this costs no reviewer calls beyond what you actually touched. An \`UNVERIFIED\` target — never reviewed, or a cohort too large for the model's context — fails the run without being a violation: that is a scoping problem, not something to fix in the file.

## Summary

Report:
- Files resolved and the violation patterns they shared
- WARNs left and why (if \`--no-warns\` was used)
- Critiques dismissed and the reason — these are the spec's own bug reports
`;
}
