---
title: Experts
description: Defines the Experts primitive in Praxis
---

# Experts

> **"This is who you are."**

A Expert defines the identity, scope, and boundaries of a contributor. It answers:
- What are you responsible for?
- What decisions can you make?
- What should you know?
- How do you interface with others?

## Important Distinction

Experts are **not job titles** — they're functional definitions.

- A single human might hold multiple experts
- An agent is typically assigned exactly one expert
- Experts can be shared across humans and agents

## The Expert as Entry Point

The expert file is the **entry point** for onboarding an agent. Its frontmatter is a **manifest** that declares everything needed to fully load the expert:

| Frontmatter Key | Purpose | Layer |
|-----------------|---------|-------|
| `constitution` | Glob patterns or paths to constitution files | 1 (Always) |
| `context` | Additional context files (conventions, lenses, etc.) | 1 (Always) |
| `practices` | What this expert owns | 2 (With expert) |
| `refs` | Supporting references | 3 (As needed) |

All paths in frontmatter are relative to the project root (the directory containing `.praxis/`).

### Sections

1. **Identity**: What this expert is and why it exists
2. **Scope**: What this expert is responsible for (and what it's not)
3. **Authorities**: What decisions this expert can make autonomously
4. **Interfaces**: How this expert interacts with other experts

## Template

```md
---
title: "{expert_name}"
type: expert
alias: "{required_alias}"

description: "Use this agent to {LIST USECASES}. This agent should be invoked {EXPLAIN AUTO INVOCATION CRITERIA}."

constitution:
  - context/constitution/*.md
context:
  - context/{relevant-context-file}.md

practices:
  - practices/{verb}-{noun}.md

refs:
  - reference/{relevant-reference}.md
---

# {expert_name} (a.k.a **{expert_name}**)

Concise description of what this expert does.

## Identity

What this expert is and why it exists. What value does it provide to the organization?

## Scope

### Responsible For

- Thing this expert owns
- Another thing this expert owns

### Not Responsible For

- Thing that might be confused as part of this expert but isn't
- Boundary clarification

## Authorities

- **Can** approve X up to Y threshold
- **Can** make decisions about Z
- **Cannot** commit to A without approval from B

## Interfaces

| With | Interaction |
|------|-------------|
| {Other Expert} | Receives X, provides Y |
| {Another Expert} | Collaborates on Z |
```
