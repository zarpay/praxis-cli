# Knowledge Primitives

Praxis organizes team knowledge into four types of documents. Understanding what each one is for — and what it is not for — is the foundation of everything else.

## The four types

### Context

Context captures *how you think and who you are* — things that apply broadly across many roles and don't change often.

Context has three subtypes:

- **Constitution** — Immutable identity. Who you are as an organization, what you value, what you refuse. This is the most stable content in the system.
- **Conventions** — Standards and norms. How you write code, how you name things, how you communicate. Changes slowly as the team evolves.
- **Lenses** — Mental models. Domain-specific frameworks that shape how a role thinks about a problem.

Context is never used directly by an agent. It is pulled into roles via the `constitution` and `context` frontmatter fields.

### Roles

A role is the central compilation unit. It represents a specific agent identity with a defined scope, set of authorities, and personality.

Each role file contains:
- **Frontmatter** — The manifest. Declares which context, responsibilities, and references to include.
- **Body** — The role description: who this agent is, what they're responsible for, what they're not, and what authorities they hold.

When you compile, Praxis reads the role's frontmatter, resolves every referenced file, and assembles one standalone profile.

### Responsibilities

A responsibility is a discrete unit of delegatable work. It describes one thing a role owns — the inputs it receives, the outputs it produces, and the criteria for doing it well.

Responsibilities are designed to be reusable. The same responsibility can be claimed by multiple roles. The compiler inlines whichever responsibilities a role declares.

### Reference

Reference documents are lookup tables, vocabulary lists, policy excerpts, and indices. They are not instructions — they are facts that an agent needs to consult while doing its job.

Examples: product catalog, refund policy, API endpoint list, team member directory.

## Why the separation matters

The separation is not cosmetic. It reflects how knowledge actually works:

- **Context changes rarely.** When your company identity changes, you want to update one file and have every agent pick it up on the next compile — not hunt down thirty prompts.
- **Responsibilities are reusable.** "Review pull requests" is a real unit of work that the code reviewer, the tech lead, and the senior engineer all share. Write it once, declare it in multiple roles.
- **Reference is consulted, not internalized.** An agent that needs your refund policy should reference it at runtime, not have it hardcoded into its identity.

## What a document looks like

Every Praxis document is a markdown file with YAML frontmatter. The frontmatter declares the document's type and metadata. The body is free-form markdown.

```yaml
---
title: Code Reviewer
type: role
alias: reviewer
description: "Reviews pull requests against team conventions."
---

# Code Reviewer

...
```

The `type` field is used by `praxis status` for categorization and by the compiler for routing. It is also what `praxis validate` checks against the directory README spec.

## See also

- [The Compiler Pipeline](/concepts/compiler-pipeline)
- [Agent Profiles](/concepts/agent-profiles)
- [Configuration](/reference/config)
