# Agent Profiles

An agent profile is the compiled output of an expert — a self-contained subject matter expert of its source material.

Scooper — the service steward compiled from Scoop Society's conventions, identity, and review practice — is not just a bundled file. It is the SME on service quality for that team: it knows your standards, owns the right practices, and understands the context that shaped those decisions. That knowledge lives in one auditable markdown file that any LLM platform can consume.

The SME framing is what makes compilation worthwhile. Update your coding conventions, recompile, and every agent that references those conventions becomes a more accurate SME automatically.

## What a profile contains

Given Scoop Society's service steward:

```yaml
---
title: Service Steward
alias: Scooper
description: "Use this agent to review Scoop Society services for convention adherence."

constitution: "knowledge/context/constitution/*.md"
context:
  - knowledge/context/conventions/result-handling.md
practices:
  - knowledge/practices/review-service-quality.md
refs:
  - knowledge/reference/api-shape.md
---
```

The compiled profile at `agent-profiles/scooper.md` looks like:

```markdown
# Role

# Service Steward (a.k.a **Scooper**)

The subject-matter expert on how Scoop Society services are written
and reviewed. ...

# Responsibilities

# Review Service Quality

...inlined body of review-service-quality.md...

# Constitution

# Scoop Society Identity

...inlined body of identity.md...

# Context

# Result Handling

...inlined body of result-handling.md...

# Reference

# API Shape Reference

...inlined body of api-shape.md...
```

Each section comes from the corresponding frontmatter key. The referenced files' own frontmatter is stripped; only the markdown bodies are inlined.

## Why a single file

One file per expert is a deliberate choice.

- **Portability** — paste it into any LLM interface, any system prompt, any agent framework.
- **Auditability** — you can read it and verify that it contains what you expect.
- **No runtime dependency** — Praxis has no SDK. The profile is the product.
- **Diff-friendly** — because it's a static file, you can track it in git and see exactly what changed when shared content changes.

## The alias

The `alias` field in an expert's frontmatter determines the output filename:

```yaml
alias: Scooper
```

Compiles to:

```
agent-profiles/scooper.md
```

If no `alias` is set, the expert's filename (without `.md`) is used as a fallback.

## Pure profiles vs plugin output

`agentProfilesOutputDir` controls where pure profiles are written. Pure profiles are plain markdown with no platform-specific wrapping.

Plugin output is separate. The Claude Code plugin, for example, wraps the same profile content with Claude Code YAML frontmatter and writes to `plugins/praxis/agents/{alias}.md`. That file is what Claude Code actually loads.

You can disable pure profile output entirely if you only want plugin output:

```json
{ "agentProfilesOutputDir": false }
```

## Profiles as spec files

A compiled profile is the SME on its source material. The natural extension is to let that same file serve as the spec that validates the code it knows about — collapsing two artifacts into one. The agent you chat with _is_ the spec that runs `praxis eval run`.

Add a `validates:` key to the expert's frontmatter with the glob patterns it should govern — plus `exemplars:`/`excludes:`/`cohort:` as needed, which compile through the same way:

```yaml
---
alias: Scooper
description: "SME on Scoop Society's service conventions."
validates:
  - "src/services/*.ts"
exemplars:
  - "src/services/create-review.ts"
excludes:
  - "src/services/legacy-import.ts"
---
```

When compiled, the profile opens with the eval-targeting frontmatter:

```markdown
---
paths:
  - "src/services/*.ts"
exemplars:
  - "src/services/create-review.ts"
excludes:
  - "src/services/legacy-import.ts"
---

# Role

# Service Steward (a.k.a **Scooper**)

...compiled knowledge...
```

The Claude Code agent file gets the same block. Both outputs are valid spec files — the eval layer reads `paths:` to know which files the spec governs and uses the profile body as the standard.

To make `praxis eval run` discover the profile as a spec, ensure:

1. The profile lands in a directory within `sources` (so spec discovery scans it)
2. `specFilePattern` matches the output filename — Scoop Society names its dispatchable spec `experts.sme.md` and sets `"specFilePattern": "{README.md,*.sme.md}"`, accepting both hand-authored READMEs and compiled profiles

The payoff: your team runs `praxis eval run` and Scooper — assembled from every source document that defines how services should be written — reviews every service file for compliance. Update the conventions, recompile, and the standard and the agent move together.

## Keeping profiles in git

It is generally good practice to commit compiled profiles alongside source documents. This lets you:

- Review what actually changed in an agent when shared content is updated
- Load the profile directly from the repository in deployment pipelines
- Catch accidental regressions during code review

If you prefer to treat profiles as build artifacts and not commit them, add `agent-profiles/` to `.gitignore`. Either approach works.

## See also

- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [praxis compile](/commands/compile)
- [Claude Code Plugin](/plugins/claude-code)
