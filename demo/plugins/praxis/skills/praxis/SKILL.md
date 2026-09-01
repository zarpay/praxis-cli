---
description: Reference for the Praxis CLI — what it does, how to use it, and how the cache and specs work.
---

# Praxis

Praxis is a CLI tool with two complementary functions:

**Conceptual linting** — spec files define what valid documents look like for a given set of files. `praxis eval run` runs each file through its spec via an LLM and caches the result. The cache is content-hash keyed: editing a file auto-invalidates its entry. Never delete the cache manually.

**Knowledge compilation** — expert files in the configured `expertsDir` are compiled into self-contained SME agent profiles and written to the Claude Code agents directory.

---

## Project structure

```
.praxis/config.json        — sources, ignore patterns, model config, specFilePattern
.praxis/cache/             — committed LLM validation results (keyed by content hash)
docs/experts/              — expert definitions compiled into SME agent profiles
.claude/agents/*.sme.md   — compiled agent profiles; also the spec files for validation
```

Config is loaded from the nearest `.praxis/` directory walking up from cwd.

---

## Key CLI commands

```bash
# Project health: document counts, validation coverage, orphaned refs
praxis status

# Validate all targeted files (all specs)
praxis eval run

# Validate scoped to one spec's files (use the "By type:" label from validate all output)
praxis eval run --type <type>

# Stop on first error — useful for sequential fixing
praxis eval run --fail-fast

# Validate a single file against its spec
praxis eval run <path>

# Force re-review without editing the file
praxis eval run <path> --no-cache

# Show full AI reasoning for a result
praxis eval run <path> --verbose

# Read cached result without an API call
praxis eval verdict <path> --verbose

# Recompile expert files into SME agent profiles
praxis compile

# Inspect or edit .praxis/config.json
praxis config show
praxis config edit
```

---

## How specs work

Spec files match `specFilePattern` (default: `README.md`, configured per project). In this project: `*.sme.md`.

A spec file with `paths:` frontmatter targets those glob patterns — files of any extension. Without `paths:`, it validates sibling files in the same directory.

The compiled SME profile IS the spec: the LLM reads the profile content as the specification when reviewing each targeted file.

---

## Cache behaviour

- Content-hash keyed: edit a file → its cache entry is automatically invalidated on next run
- Both the document and the spec content are hashed — changing the spec invalidates all entries for files it covers
- `--no-cache` forces re-review without editing (use sparingly, mainly to check LLM non-determinism on borderline results)
- Never delete `.praxis/cache/` — it accumulates valid results and saves API calls
