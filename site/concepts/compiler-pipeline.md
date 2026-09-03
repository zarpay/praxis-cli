# The Compiler Pipeline

`praxis compile` reads expert files, resolves every reference declared in their frontmatter, and assembles standalone agent profiles. This page explains exactly what happens, using Scoop Society's *service steward*.

## Input: an expert file

The compiler starts from every `.md` file in the configured `expertsDir` (skipping templates and spec files). `knowledge/experts/service-steward.md`:

```yaml
---
title: Service Steward
type: expert
alias: Scooper
description: "Use this agent to review Scoop Society services for convention adherence, or for advice when writing a new service."

constitution: "knowledge/context/constitution/*.md"
context:
  - knowledge/context/conventions/result-handling.md
practices:
  - knowledge/practices/review-service-quality.md
refs:
  - knowledge/reference/api-shape.md

validates:
  - src/services/*.ts
exemplars:
  - src/services/create-review.ts
excludes:
  - src/services/legacy-import.ts
---
# Service Steward (a.k.a **Scooper**)

The subject-matter expert on how Scoop Society services are written
and reviewed.
```

Each reference key is a path or glob pattern (or a list of them), relative to the project root. A bare value and its one-element list form are the same declaration.

## Resolution

1. **Glob expansion** — patterns like `knowledge/context/constitution/*.md` expand to every matching file.
2. **Deterministic ordering** — expanded matches are sorted, so recompiling without changes is a no-op diff.
3. **Exclusions** — spec files (per `specFilePattern`) and `_`-prefixed templates are never inlined.
4. **Problems are warnings, not aborts** — a glob matching nothing or a declared file that doesn't exist is reported per reference, and the rest of the profile still compiles. A typo shouldn't cost you the whole agent, but you do get told.

## Assembly

Resolved bodies are assembled in a fixed section order, each referenced file's frontmatter stripped:

```
# Role             ← the expert file's own body
# Responsibilities ← inlined from practices:
# Constitution     ← inlined from constitution:
# Context          ← inlined from context:
# Reference        ← inlined from refs:
```

Constitution blocks flow together as one continuous statement of identity; the other sections separate their documents with rules. An empty section is omitted, never rendered as a bare heading.

## Output: the agent profile

The assembled profile is written to `{agentProfilesOutputDir}/{alias}.md` — here, `agent-profiles/scooper.md`. Because this expert declares `validates:`, the profile also opens with the eval-targeting frontmatter (`paths:`, `exemplars:`, `excludes:`) that makes it a working **spec**: the compiled agent and the standard that reviews `src/services/*.ts` are the same file. See [Profiles as spec files](/concepts/agent-profiles#profiles-as-spec-files).

The output is plain markdown — no special syntax, no runtime dependency. It can be dropped into Claude Code, loaded as a system prompt via any LLM API, or read by a human who wants to know what the agent knows.

## Plugin output

After the pure profile, the compiler hands the same content to each enabled plugin. The Claude Code plugin prepends agent frontmatter (name, description, tools, model) and writes to its own output directory. See [Plugins](/plugins/overview).

## Watch mode

```bash
praxis compile --watch
```

Watches every directory in `sources` and recompiles on change, debounced. Editing a shared constitution file recompiles every expert that includes it — the propagation that makes compilation worthwhile.

## Single expert compilation

```bash
praxis compile --alias scooper
```

Compiles only the matching expert (aliases match case-insensitively). Useful during authoring.

## See also

- [Knowledge Primitives](/concepts/knowledge-primitives)
- [Agent Profiles](/concepts/agent-profiles)
- [praxis compile](/commands/compile)
