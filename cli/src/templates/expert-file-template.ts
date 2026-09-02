import type { ExpertTemplateVars } from "@/types.js";

/**
 * The document `praxis add expert <name>` writes.
 *
 * Two values come from the command — the display title and the alias the
 * compiler keys the expert on. The alias is the name as typed, because it
 * is an identifier rather than prose.
 *
 * Every other `{token}` below is guidance the author replaces by hand, so
 * it is literal text here rather than a parameter.
 */
export default function expertFileTemplate({ title, alias }: ExpertTemplateVars): string {
  return `---
title: "${title}"
type: expert
alias: "${alias}"

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

# ${title} (a.k.a **${title}**)

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
`;
}
