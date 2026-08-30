---
title: "{expert_name}"
type: expert
manager: "{manager_email}"
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
