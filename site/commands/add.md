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

description: "Use this agent to {WHAT IT REVIEWS OR ANSWERS}. Use it when {A FILE UNDER some/path/ IS ADDED OR CHANGED, OR THE QUESTION SOMEONE ASKS}."

constitution:
  - context/constitution/*.md
context:
  - context/{relevant-context-file}.md

practices:
  - practices/{verb}-{noun}.md

refs:
  - reference/{relevant-reference}.md

validates:
  - "{glob of the files this expert reviews — delete this key for an expert people only consult}"
---

# Service Steward

{Who this expert reads as, and what that reader cares about. Say what problem it solves and what it leaves to other experts. Keep it to one or two short paragraphs. Do not list checks here; they belong in the practices.}

{Why each context file above is loaded: what it changes about how this expert reads a file.}
```

The shape is the one the scaffold's recruiter reviews for, so a filled-in file passes `praxis eval run --type praxis-recruiter`. The practice template follows the same idea: criteria written as judgment calls, each with its reason, one pass/fail pair, and at least one "never".

## Does not overwrite

`praxis add` will not create a file if one already exists at the target path. Run it, then edit the generated file.

## See also

- [praxis compile](/commands/compile)
- [Knowledge Primitives](/concepts/knowledge-primitives)
