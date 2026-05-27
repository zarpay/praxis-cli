# Agent Profiles

An agent profile is the compiled output of a role — a self-contained subject matter expert of its source material.

The code reviewer agent compiled from your coding conventions, team principles, and responsibility definitions is not just a bundled file. It is the SME on code review for your team: it knows your standards, owns the right responsibilities, and understands the context that shaped those decisions. That knowledge lives in one auditable markdown file that any LLM platform can consume.

The SME framing is what makes compilation worthwhile. Update your coding conventions, recompile, and every agent that references those conventions becomes a more accurate SME automatically.

## What a profile contains

Given a role with this frontmatter:

```yaml
---
title: Code Reviewer
alias: reviewer
description: "Reviews pull requests against team conventions."

constitution:
  - context/constitution/identity.md
  - context/constitution/principles.md
context:
  - context/conventions/code-style.md
responsibilities:
  - responsibilities/review-pull-requests.md
  - responsibilities/enforce-standards.md
refs:
  - reference/architecture-decisions.md
---
```

The compiled profile at `agent-profiles/reviewer.md` looks like:

```markdown
# Code Reviewer

Reviews pull requests against team conventions.

## Scope

...role body content here...

---

## Responsibilities

### Review Pull Requests

...inlined body of review-pull-requests.md...

### Enforce Standards

...inlined body of enforce-standards.md...

---

## Constitution

...inlined body of identity.md...

...inlined body of principles.md...

---

## Context

...inlined body of code-style.md...

---

## Reference

...inlined body of architecture-decisions.md...
```

Each section comes from the corresponding frontmatter array. The referenced files' own frontmatter is stripped; only the markdown body is included.

## Why a single file

One file per role is a deliberate choice.

- **Portability** — paste it into any LLM interface, any system prompt, any agent framework.
- **Auditability** — you can read it and verify that it contains what you expect.
- **No runtime dependency** — Praxis has no SDK. The profile is the product.
- **Diff-friendly** — because it's a static file, you can track it in git and see exactly what changed when shared content changes.

## The alias

The `alias` field in a role's frontmatter determines the output filename:

```yaml
alias: reviewer
```

Compiles to:

```
agent-profiles/reviewer.md
```

If no `alias` is set, the role's filename (without `.md`) is used as a fallback.

## Pure profiles vs plugin output

`agentProfilesOutputDir` controls where pure profiles are written. Pure profiles are plain markdown with no platform-specific wrapping.

Plugin output is separate. The Claude Code plugin, for example, wraps the same profile content with Claude Code YAML frontmatter and writes to `plugins/praxis/agents/{alias}.md`. That file is what Claude Code actually loads.

You can disable pure profile output entirely if you only want plugin output:

```json
{ "agentProfilesOutputDir": false }
```

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
