---
title: Praxis
description: A knowledge framework for humans and agents
---

# Praxis

> A knowledge framework for humans and agents.

---

## The Philosophy

Praxis is a framework for organizing knowledge so that both humans and AI agents can operate effectively within an organization. It treats agents as **first-class contributors** — not tools to be prompted, but workers to be onboarded, given experts, and delegated practices.

The framework is built on a simple premise: **if you cannot clearly explain how your organization works to a new team member, you cannot effectively delegate to an agent.** Praxis forces that clarity.

---

## Directory Structure

```
my-org/
├── .praxis/
│   └── config.json            # Project configuration
├── context/
│   ├── constitution/           # Immutable identity
│   ├── conventions/            # Standards and norms
│   └── lenses/                 # Mental models
├── experts/                      # Expert definitions
├── practices/           # Delegatable work
├── reference/                  # Definitions, templates, indices
├── agent-profiles/             # Compiled agent profiles (auto-generated)
└── plugins/                    # Plugin output (auto-generated)
```

---

## The Four Primitives

| Primitive | "This is..." |
|-----------|--------------|
| **[Context](./context/)** | "This is who we are and how we think" |
| **[Experts](./experts/)** | "This is who you are" |
| **[Practices](./practices/)** | "This is what you own" |
| **[Reference](./reference/)** | "This is what things mean" |

---

## CLI Usage

```bash
# Compile all agents
praxis compile

# Compile a single agent by alias
praxis compile --alias stewart

# Validate all documents
praxis validate all

# Show project status
praxis status

# Show version
praxis --version
```

---

## Getting Started

1. **Start with `context/constitution/`** — Write down who you are, what you value, why you exist
2. **Add `context/conventions/`** — Document how you do things
3. **Define your first Expert** — Create a file in `experts/`
4. **Create your first Practice** — Create a file in `practices/`
5. **Build Reference as needed** — Add definitions and catalogs to `reference/`
