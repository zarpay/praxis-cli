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
praxis add expert code-reviewer
# Creates: experts/code-reviewer.md

praxis add practice review-pull-requests
# Creates: practices/review-pull-requests.md
```

## Output paths

Output paths are determined by the `expertsDir` and `practicesDir` fields in `.praxis/config.json`:

```json
{
  "expertsDir": "experts",
  "practicesDir": "practices"
}
```

If you've configured a custom directory (e.g., `"expertsDir": "agents/experts"`), `praxis add expert` writes there instead.

## Template files

The template for each type lives at `_template.md` inside the relevant directory. `praxis init` creates these templates, and `praxis add` reads from them.

If you customize a `_template.md`, all future `praxis add` calls for that type use your custom template.

A typical expert template after `praxis init`:

```markdown
---
title: { Expert Name }
type: expert
alias: { required_alias }
description: ""

constitution:
  - context/constitution/*.md
context: []
practices: []
refs: []
---

# {Expert Name}

Brief description of this expert.

## Scope

### Responsible For

- ...

### Not Responsible For

- ...

## Authorities

- **Can** ...
- **Cannot** ...
```

## Does not overwrite

`praxis add` will not create a file if one already exists at the target path. Run it, then edit the generated file.

## See also

- [praxis compile](/commands/compile)
- [Knowledge Primitives](/concepts/knowledge-primitives)
