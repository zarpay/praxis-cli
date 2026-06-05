---
description: Reference for the Praxis CLI — what it does, how to use it, and how the cache and specs work.
---

# Praxis

Praxis is a CLI tool with two complementary functions:

**Conceptual linting** — spec files define what valid documents look like for a given set of files. `praxis validate` runs each file through its spec via an LLM and caches the result. The cache is content-hash keyed: editing a file auto-invalidates its entry. Never delete the cache manually.

**Knowledge compilation** — role files are compiled into self-contained SME agent profiles written to the Claude Code agents directory.

---

## Project structure

```
.praxis/config.json        — sources, ignore patterns, model config, specFilePattern
.praxis/cache/             — committed LLM validation results (keyed by content hash)
docs/roles/                — role definitions compiled into SME agent profiles
.claude/agents/*.sme.md   — compiled agent profiles; also the spec files for validation
```

Config is loaded from the nearest `.praxis/` directory walking up from cwd.

---

## Key CLI commands

```bash
praxis status                                      # health: counts, validation coverage
praxis validate all                                # validate all targeted files
praxis validate all --type <type>                  # scope to one spec (use "By type:" label)
praxis validate all --fail-fast                    # stop on first error
praxis validate document <path>                    # validate one file
praxis validate document <path> --no-cache         # force re-evaluation without editing
praxis validate document <path> --verbose          # show full AI reasoning
praxis validate report <path> --verbose            # read cached result, no API call
praxis compile                                     # recompile roles into SME agent profiles
praxis config show                                 # print .praxis/config.json
praxis config edit                                 # open config in $EDITOR
```

---

## How specs work

Spec files match `specFilePattern` (configured per project, default `README.md`). A spec with `paths:` frontmatter targets those glob patterns — files of any extension. Without `paths:`, it validates sibling files in its directory.

The compiled SME profile IS the spec: the LLM reads the profile content as the specification when evaluating each targeted file.

---

## Cache behaviour

- Both the document and spec content are hashed — changing the spec invalidates all entries for files it covers
- `--no-cache` forces re-evaluation without editing (use sparingly)
- Never delete `.praxis/cache/` — it accumulates valid results and saves API calls
