# praxis add

Creates a new document from a template with placeholders pre-filled.

## Usage

```bash
praxis add role <name>
praxis add responsibility <name>
```

The `<name>` argument should be kebab-case. It is used as the filename and pre-filled into the template.

## Examples

```bash
praxis add role code-reviewer
# Creates: roles/code-reviewer.md

praxis add responsibility review-pull-requests
# Creates: responsibilities/review-pull-requests.md
```

## Output paths

Output paths are determined by the `rolesDir` and `responsibilitiesDir` fields in `.praxis/config.json`:

```json
{
  "rolesDir": "roles",
  "responsibilitiesDir": "responsibilities"
}
```

If you've configured a custom directory (e.g., `"rolesDir": "agents/roles"`), `praxis add role` writes there instead.

## Template files

The template for each type lives at `_template.md` inside the relevant directory. `praxis init` creates these templates, and `praxis add` reads from them.

If you customize a `_template.md`, all future `praxis add` calls for that type use your custom template.

A typical role template after `praxis init`:

```markdown
---
title: {Role Name}
type: role
alias: {required_alias}
description: ""

constitution:
  - context/constitution/*.md
context: []
responsibilities: []
refs: []
---

# {Role Name}

Brief description of this role.

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
