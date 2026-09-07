# praxis add

Creates a new document from a template with placeholders pre-filled.

## Usage

```bash
praxis add expert <name>
praxis add practice <name>
```

The `<name>` argument should be kebab-case. It is used as the filename and pre-filled into the template.

## Examples

```bash
praxis add expert service-steward
# Creates: knowledge/experts/service-steward.md

praxis add practice review-service-quality
# Creates: knowledge/practices/review-service-quality.md
```

(Paths follow `expertsDir`/`practicesDir` — Scoop Society keeps its taxonomy under `knowledge/`.)

## Output paths

Output paths are determined by the `expertsDir` and `practicesDir` fields in `.praxis/config.json`:

```json
{
  "expertsDir": "knowledge/experts",
  "practicesDir": "knowledge/practices"
}
```

An existing file is never overwritten — `add` scaffolds, it does not edit.

If you've configured a custom directory (e.g., `"expertsDir": "agents/experts"`), `praxis add expert` writes there instead.

## Templates are built in

The document each type starts from is compiled into the CLI — a typed template function, not a file in your project. `praxis add` fills the title and alias from the `<name>` you pass and writes the result. There is no `_template.md` to customize; every `{token}` left in the generated file is guidance for you to replace by hand.

What `praxis add expert service-steward` writes:

```markdown
---
title: "Service Steward"
type: expert
alias: "service-steward"

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

# Service Steward (a.k.a **Service Steward**)

Concise description of what this expert does.

## Identity

What this expert is and why it exists.

## Scope

### Responsible For

- Thing this expert owns

### Not Responsible For

- Boundary clarification

## Authorities

- **Can** approve X up to Y threshold
- **Cannot** commit to A without approval from B

## Interfaces

| With | Interaction |
|------|-------------|
| {Other Expert} | Receives X, provides Y |
```

## Does not overwrite

`praxis add` will not create a file if one already exists at the target path. Run it, then edit the generated file.

## See also

- [praxis compile](/commands/compile)
- [Knowledge Primitives](/concepts/knowledge-primitives)
