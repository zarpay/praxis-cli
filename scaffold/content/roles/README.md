---
title: Roles
type: framework
framework: true
description: Defines the Roles primitive in Praxis
---

# Roles

> **"This is who you are."**

A Role defines the identity, scope, and boundaries of a contributor. It answers:
- What are you responsible for?
- What decisions can you make?
- What should you know?
- How do you interface with others?

## Important Distinction

Roles are **not job titles** — they're functional definitions.

- A single human might hold multiple roles
- An agent is typically assigned exactly one role
- Roles can be shared across humans and agents

## The Role as Entry Point

The role file is the **entry point** for onboarding an agent. Its frontmatter is a **manifest** that declares everything needed to fully load the role:

| Frontmatter Key | Purpose | Layer |
|-----------------|---------|-------|
| `constitution` | Loads all constitution files when set to `true` | 1 (Always) |
| `context` | Additional context files (conventions, lenses, etc.) | 1 (Always) |
| `responsibilities` | What this role owns | 2 (With role) |
| `refs` | Supporting references | 3 (As needed) |

## Role Document Structure

```yaml
---
title: Role Name
type: role
manager: email@example.com
alias: ShortName
agent_description: "Description of when to invoke this agent"

constitution: true
context:
  - content/context/conventions/relevant-convention.md
responsibilities:
  - content/responsibilities/verb-noun.md
refs:
  - content/reference/relevant-reference.md
---
```

**Note:** `constitution: true` automatically loads all files from `content/context/constitution/*.md`.

### Sections

1. **Identity**: What this role is and why it exists
2. **Scope**: What this role is responsible for (and what it's not)
3. **Authorities**: What decisions this role can make autonomously
4. **Interfaces**: How this role interacts with other roles

## Example

See [_template.md](./_template.md) for a starter template.
