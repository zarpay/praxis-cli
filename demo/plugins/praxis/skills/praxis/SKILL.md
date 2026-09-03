---
description: Reference for the Praxis CLI — what it does, how to use it, and how specs, the cache, and the ledger work.
---

# Praxis

Praxis is a CLI with two complementary functions:

**Conceptual linting** — spec files state what correct looks like for the files they govern. `praxis eval run` has an LLM reviewer read each file against its spec and caches the verdict. The cache is content-hash keyed: editing a file (or its spec) auto-invalidates its entry. Never delete the cache manually.

**Knowledge compilation** — expert files in the configured `expertsDir` compile into self-contained SME agent profiles, and each enabled plugin writes its own output (this document was written by the claude-code plugin).

Every run also appends evidence to the ledger: one run record per reviewer plus one critique per issue, at `.praxis/ledger/`. Recurring critiques triage into **axioms** — named, ratified standards that join the reviewer's checklist.

---

## Project structure

```
.praxis/config.json   — sources, reviewers, ignore patterns, specFilePattern
.praxis/cache/        — committed verdicts, keyed by content hash
.praxis/ledger/       — append-only run and critique records (committed)
.praxis/axioms/       — ratified standards; proposals under axioms/proposed/
```

Config is loaded from the nearest `.praxis/` directory walking up from cwd.

---

## Key CLI commands

```bash
# Orientation: last run, pending triage, proposals, debt at a glance
praxis

# Project health: document counts, review coverage, structural issues
praxis status

# Review all targeted files (all specs)
praxis eval run

# Review scoped to one spec's targets (the "By type:" label from a full run)
praxis eval run --type <type>

# Stop on first error — useful for sequential fixing
praxis eval run --fail-fast

# Review a single file against its spec (the fast loop)
praxis eval run <path>

# Force re-review without editing the file
praxis eval run <path> --no-cache

# Show full reviewer reasoning for a result
praxis eval run <path> --verbose

# Read a cached verdict without an API call
praxis eval verdict <path> --verbose

# One axiom in full — the drill-down behind a cited [AX-xxxxxx]
praxis axioms show <id>

# Reports over the ledger (reads only, never calls a reviewer)
praxis eval report
praxis debt report

# Recompile expert files into SME agent profiles
praxis compile

# Inspect or edit .praxis/config.json
praxis config show
praxis config edit
```

---

## How specs work

Spec files match `specFilePattern` (default `README.md`; check `.praxis/config.json`).

A spec with `paths:` frontmatter governs those glob patterns — files of any extension. Without `paths:`, it governs sibling files in its own directory. `excludes:` shields files from review, `exemplars:` are spec-blessed positives shown to the reviewer, and `context:` is assist-only material inlined into the prompt.

When a finding cites an axiom id like `[AX-3f9c2d]`, the standard is ratified and stable: `praxis axioms show <id>` explains it with a violating and a compliant example.

---

## Cache behaviour

- Content-hash keyed: edit a file → its entry auto-invalidates on the next run
- The hash covers everything the reviewer saw — target, spec, assist files, and the active axiom checklist — so changing any of them invalidates the verdicts they produced
- `--no-cache` forces re-review without editing (use sparingly, mainly to check reviewer non-determinism on borderline results)
- Never delete `.praxis/cache/` — it accumulates valid verdicts and saves API calls
