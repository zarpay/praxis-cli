---
title: "[Role Name]"
type: role
manager: "[email@example.com]"
alias: "[required short name]"

agent_description: "Use this agent to {LIST USECASES}. This agent should be invoked {EXPLAIN AUTO INVOCATION CRITERIA}."

constitution: true
context:
  - content/context/[relevant-context-file].md

responsibilities:
  - content/responsibilities/[verb]-[noun].md

refs:
  - content/reference/[relevant-reference].md
---

# [Role Name] (a.k.a **[Alias]**)

Concise description of what this role does.

## Identity

What this role is and why it exists. What value does it provide to the organization?

## Scope

### Responsible For

- Thing this role owns
- Another thing this role owns

### Not Responsible For

- Thing that might be confused as part of this role but isn't
- Boundary clarification

## Authorities

- **Can** approve X up to Y threshold
- **Can** make decisions about Z
- **Cannot** commit to A without approval from B

## Interfaces

| With | Interaction |
|------|-------------|
| [Other Role] | Receives X, provides Y |
| [Another Role] | Collaborates on Z |
