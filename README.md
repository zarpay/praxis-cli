# Praxis

**A knowledge framework for humans and AI agents.**

Praxis is a CLI tool and organizational framework that structures your team's knowledge so both humans and AI agents can operate effectively. It treats agents as first-class contributors — not tools to be prompted, but workers to be onboarded, given roles, and delegated responsibilities.

The premise is simple: **if you can't clearly explain how your organization works to a new team member, you can't effectively delegate to an agent.** Praxis forces that clarity.

## Install

```bash
npm install -g praxis-cli
```

Requires Node.js 18+.

## Quick Start

```bash
# Scaffold a new Praxis project
praxis init my-org

cd my-org

# Edit the scaffolded files to describe your organization
# Then compile your agents
praxis compile
```

That's it. Praxis scaffolds the directory structure, you fill in the knowledge, and `compile` produces self-contained agent files ready for Claude Code.

## How It Works

Praxis organizes knowledge into four primitives:

| Primitive | Purpose | Example |
|-----------|---------|---------|
| **Context** | "This is who we are and how we think" | Company identity, followed conventions, mental models |
| **Roles** | "This is who you are" | A role definition with scope, boundaries, and personality |
| **Responsibilities** | "This is what you own" | Discrete units of work delegated to a role |
| **Reference** | "This is what things mean" | Vocabulary, indices, lookup tables |

A **Role** is the central unit. Each role declares what context it needs, what responsibilities it owns, and what references it consults. When you run `praxis compile`, it reads each role's manifest, inlines all referenced content, and produces a single standalone markdown file — a compiled agent profile.

```
content/
├── context/
│   ├── constitution/       # Who you are (identity, principles)
│   ├── conventions/        # How you do things (standards, norms)
│   └── lenses/             # How you think (mental models)
├── roles/                  # Role definitions
├── responsibilities/       # Delegatable work units
└── reference/              # Definitions, indices, templates
```

## Use Cases

### Onboard an AI agent to your codebase

Define your organization's identity, coding conventions, and architecture decisions in `context/`. Create a role like `code-reviewer` that references your conventions and has responsibilities like `review-pull-requests`. Compile it, and you have an agent profile that understands your standards.

```yaml
# content/roles/code-reviewer.md
---
title: Code Reviewer
alias: reviewer
agent_description: Reviews pull requests against team conventions
constitution: true
context:
  - content/conventions/*.md
responsibilities:
  - content/context/responsibilities/review-pull-requests.md
  - content/context/responsibilities/enforce-style-guide.md
reference:
  - content/context/references/architecture-decisions.md
---
```

### Create a framework-aware assistant

The two built-in roles (Stewart and Remy) ship with every Praxis project. Stewart helps contributors navigate the framework — where content belongs, whether it follows conventions, and whether the framework is healthy. Remy challenges role and responsibility designs before they ship.

```bash
praxis init my-project && cd my-project
praxis compile

# Stewart and Remy are ready in plugins/praxis/agents/
```

### Validate your documentation

Praxis includes AI-powered validation that checks documents against their directory's specification (the README that defines what files in that directory should look like).

```bash
# Validate a single document
praxis validate document content/roles/my-role.md

# Validate everything
praxis validate all

# Run in CI
praxis validate ci --strict
```

Validation requires an [OpenRouter](https://openrouter.ai) API key:

```bash
export OPENROUTER_API_KEY=your-key-here
```

## CLI Reference

```
praxis init [directory]              Scaffold a new Praxis project
praxis compile                       Compile all roles into agent files
praxis compile --alias <name>        Compile a single role by alias
praxis validate document <path>      Validate a single document
praxis validate all                  Validate all documents
praxis validate ci                   Run validation in CI mode
```

## Writing Your First Role

After `praxis init`, create a role file:

```yaml
# content/roles/my-agent.md
---
title: My Agent
type: role
alias: my-agent
agent_description: Does the thing you need done
constitution: true
context:
  - path/to/convention-docs.md
responsibilities:
  - path/to/responsibility-docs.md
reference:
  - path/to/referrence-docs.md
---

# My Agent

Describe what this agent does, how it thinks, and what its boundaries are.

## Scope

### Responsible For
- Doing the thing

### Not Responsible For
- Everything else
```

Then create the responsibility it references:

```yaml
# content/responsibilities/do-the-thing.md
---
title: Do the Thing
type: responsibility
owner: my-agent
---

# Do the Thing

## Objective
What this responsibility achieves.

## Criteria
How to know it's done well.
```

Run `praxis compile` and find your compiled agent at `plugins/praxis/agents/my-agent.md`.

## License

MIT
