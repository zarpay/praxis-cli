---
layout: home
hero:
  name: Praxis
  text: Structured knowledge for humans and AI agents
  tagline: Organize roles, responsibilities, and context into compiled agent profiles that any LLM platform can consume — with AI-powered validation to keep the knowledge honest.
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/
    - theme: alt
      text: Learn the Concepts
      link: /concepts/knowledge-primitives
---

## What Praxis is for

Praxis is for teams that want both humans and AI agents to operate from the same knowledge base.

It answers questions like:

- How do we define what a "code reviewer" agent is allowed to do — and keep that definition in sync across ten places?
- How do we make sure the AI agent calling our Linear API knows our project conventions without copy-pasting a wall of text into every prompt?
- How do we validate that our knowledge documents are actually well-formed before they end up in production agents?

The answer is a knowledge compiler: write structured markdown, declare dependencies in frontmatter, run `praxis compile`, get a single self-contained agent profile.

## The four primitives

Praxis organizes everything into four document types:

| Primitive | What it captures | Example |
| --- | --- | --- |
| **Context** | Who you are and how you think | Company identity, coding conventions, mental models |
| **Roles** | Who an agent is | A code reviewer with scope, authorities, and personality |
| **Responsibilities** | What a role owns | Reviewing pull requests, enforcing standards |
| **Reference** | What things mean | Vocabulary, indices, policy excerpts |

Roles are the central unit. A role's frontmatter declares which context it needs, which responsibilities it owns, and which references it consults. The compiler resolves all of that and produces one standalone file.

## A two-minute example

```bash
npm install -g @zarpay/praxis-cli
praxis init my-org
cd my-org
praxis add role code-reviewer
```

Edit `roles/code-reviewer.md`:

```yaml
---
title: Code Reviewer
alias: reviewer
description: "Reviews pull requests against team conventions and coding standards."

constitution:
  - context/constitution/*.md
context:
  - context/conventions/code-style.md
responsibilities:
  - responsibilities/review-pull-requests.md
refs:
  - reference/architecture-decisions.md
---
```

Then:

```bash
praxis compile
# → agent-profiles/reviewer.md
```

The compiled file contains the role body, every responsibility inlined, the company constitution, the code-style convention, and the architecture reference — all in one readable markdown file that any agent platform can consume.

## What the compiler guarantees

| Concern | Praxis answer |
| --- | --- |
| Completeness | Every referenced file is inlined at compile time |
| Sync | Change a shared file, recompile — all agents pick it up |
| Structure | READMEs double as specs; `praxis validate` checks conformance |
| Portability | Output is plain markdown — no SDK, no runtime dependency |

## How to read the docs

- **Quick Start** gets one role compiled end-to-end.
- **Concepts** explains the mental model before you customize anything.
- **Commands** is the full CLI reference.
- **Validation** covers writing specs and running checks in CI.
- **Plugins** covers platform-specific output (Claude Code today, others possible).
- **Design** explains the tradeoffs and what was deliberately left out.
- **[CHANGELOG](https://github.com/zarpay/praxis-cli/blob/main/CHANGELOG.md)** lists what changed in each release.

::: tip Start with Concepts if you're new
The Quick Start gets something working. The Concepts section explains *why* it works that way — which matters once you start customizing project structure.
:::
