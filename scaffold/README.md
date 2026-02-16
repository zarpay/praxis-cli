---
title: Praxis
type: framework
framework: true
description: A knowledge framework for humans and agents
---

# Praxis

> A knowledge framework for humans and agents.

---

## The Philosophy

Praxis is a framework for organizing knowledge so that both humans and AI agents can operate effectively within an organization. It treats agents as **first-class contributors** — not tools to be prompted, but workers to be onboarded, given roles, and delegated responsibilities.

The framework is built on a simple premise: **if you cannot clearly explain how your organization works to a new team member, you cannot effectively delegate to an agent.** Praxis forces that clarity.

---

## Directory Structure

```
praxis/
├── content/
│   ├── context/
│   │   ├── constitution/    # Immutable identity
│   │   ├── conventions/     # Standards and norms
│   │   └── lenses/          # Mental models
│   ├── roles/               # Role definitions
│   ├── responsibilities/    # Delegatable work
│   └── reference/           # Definitions, templates, indices
├── plugins/
│   └── praxis/
│       ├── agents/          # Compiled agent files (auto-generated)
│       └── commands/        # Plugin commands
└── .claude-plugin/          # Claude Code marketplace
```

---

## The Four Primitives

| Primitive | "This is..." |
|-----------|--------------|
| **[Context](./content/context/)** | "This is who we are and how we think" |
| **[Roles](./content/roles/)** | "This is who you are" |
| **[Responsibilities](./content/responsibilities/)** | "This is what you own" |
| **[Reference](./content/reference/)** | "This is what things mean" |

---

## CLI Usage

```bash
# Compile all agents
praxis compile

# Compile a single agent by alias
praxis compile --alias stewart

# Validate all documents
praxis validate all

# Show version
praxis --version
```

---

## Getting Started

1. **Start with `content/context/constitution/`** — Write down who you are, what you value, why you exist
2. **Add `content/context/conventions/`** — Document how you do things
3. **Define your first Role** — Create a file in `content/roles/`
4. **Create your first Responsibility** — Create a file in `content/responsibilities/`
5. **Build Reference as needed** — Add definitions and catalogs to `content/reference/`
