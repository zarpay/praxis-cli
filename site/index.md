---
layout: home
hero:
  name: Praxis
  text: Conceptual linting and knowledge compilation
  tagline: Define what valid looks like in any directory. Enforce it with AI. Compile knowledge documents into agent profiles that are subject matter experts of their source material.
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/
    - theme: alt
      text: Learn the Concepts
      link: /concepts/knowledge-primitives
---

## The problem

Every codebase has patterns that can't be caught by a syntax checker.

Your service objects are supposed to follow a specific architectural shape. Your architecture decision records have a format everyone agreed on. Your agent role definitions declare what each agent owns, its boundaries, and its authorities. Your API specs follow a structure your team designed.

Nobody enforces any of it. The README says one thing. Half the files do another. The conventions document was updated in March but three places still follow the old pattern. This is **conceptual drift** — and it compounds silently.

## Two capabilities

Praxis addresses this with two distinct tools that are designed to work together.

### Conceptual linting

Write a README spec for any directory that describes what valid documents look like — required fields, required sections, structural conventions, content expectations. Then run `praxis validate` to check every document in that directory against it.

This works for any organized body of files, not just AI knowledge documents:

| Directory | What the spec enforces |
| --- | --- |
| `app/services/` | Architectural patterns, method naming, interface conventions |
| `decisions/` | ADR format, required context and status sections |
| `roles/` | Required frontmatter, scope structure, authority declarations |
| `api/specs/` | Endpoint naming, request/response shape requirements |

The spec is your `.eslintrc` for concepts. `praxis validate` is the linter that checks every document against it — and can run in CI, blocking merges that violate the standard.

### Knowledge compilation

When those documents are knowledge files — roles, responsibilities, context, reference — `praxis compile` assembles them into **agent profiles**: self-contained documents that are subject matter experts of their source material.

The code reviewer agent compiled from your conventions, principles, and responsibility definitions becomes the SME on code review for your team. One source of truth. One compile step. One deployable profile that any LLM platform can consume.

The propagation story is what makes compilation worthwhile: update your coding conventions once, recompile, and every agent that references those conventions is updated. No hunting down twelve prompts. No drift between agents.

## How they fit together

You don't need compilation to use conceptual linting. You can add a `README.md` spec to your `app/services/` directory and run `praxis validate` against it without ever touching the agent profile features.

But for teams building with AI agents, the two reinforce each other: linting keeps the source knowledge honest, and compilation turns trusted knowledge into deployable SME agents.

## The knowledge primitives

When using Praxis for knowledge compilation, documents are organized into four types:

| Primitive | What it captures | Example |
| --- | --- | --- |
| **Context** | Who you are and how you think | Company identity, coding conventions, mental models |
| **Roles** | Who an agent is | A code reviewer with scope, authorities, and personality |
| **Responsibilities** | What a role owns | Reviewing pull requests, enforcing standards |
| **Reference** | What things mean | Vocabulary, indices, policy excerpts |

Roles are the compilation unit. A role's frontmatter declares which context, responsibilities, and references to include. The compiler resolves all of it and produces one standalone profile.

## How to read the docs

- **Quick Start** walks through conceptual linting and compilation end-to-end.
- **Concepts** explains the knowledge model before you customize anything.
- **Commands** is the full CLI reference.
- **Validation** covers writing specs and running checks in CI.
- **Plugins** covers platform-specific output (Claude Code today).
- **Design** explains the reasoning behind the tool's key choices.
- **[CHANGELOG](https://github.com/zarpay/praxis-cli/blob/main/CHANGELOG.md)** lists what changed in each release.
