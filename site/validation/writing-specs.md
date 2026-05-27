# Writing Specs

## The README as a lint rule

Every directory with organized files has implicit standards. The question is whether anything enforces them.

A Praxis spec makes those standards explicit. The README in any directory is your `.eslintrc` for that directory — it defines what valid documents look like, and `praxis validate` is the linter that checks every document against it.

This isn't specific to knowledge documents. A `app/services/` directory can have a README that says every service must have a single public `#call` method and return a `Result` type. A `decisions/` directory can have a README that says every ADR must have Context, Decision, and Consequences sections. A `roles/` directory can have a README that says every role must declare its boundaries and authorities.

Write the spec in clear human language — the LLM reads it as instructions.

## A minimal spec

```markdown
# Roles

Documents in this directory define agent roles.

## Required frontmatter

- `title` (string) — display name of the role
- `type` (string) — must be `"role"`
- `alias` (string) — short identifier used for the compiled filename
- `description` (string) — one-sentence summary of what the agent does

## Required sections

Every role document must have a `## Scope` section that contains both:
- `### Responsible For` — bullet list of what the role owns
- `### Not Responsible For` — bullet list of explicit exclusions
```

This tells the LLM exactly what to check: four frontmatter fields and two required markdown sections. A document missing any of those will get a FAIL or WARN.

## A non-knowledge example

The same mechanism works for any directory:

```markdown
# Service Objects

Every file in `app/services/` must follow our service object pattern.

## Required structure

- One public method: `#call` — no other public methods
- Return type: always a `Result` object (success or failure)
- Header comment: one paragraph explaining what the service does and when to use it

## Not allowed

- Instance variables that persist state across calls
- Raising exceptions for expected failure cases — use `Result.failure` instead
- Direct database writes — call a repository instead
```

`praxis validate all` checks every `.rb` file in `app/services/` against this spec. PRs that add a service with extra public methods, no Result type, or no header comment get flagged before they merge.

## Required vs recommended

The LLM respects the distinction between required and recommended:

```markdown
## Required

- `title` frontmatter field
- `## Scope` section with `### Responsible For` and `### Not Responsible For` subsections

## Recommended

- `## Authorities` section listing explicit permissions
- `description` field with a one-sentence summary
```

Documents missing a **required** item receive a FAIL result. Documents missing a **recommended** item receive a WARN. Use language like "must include" for required things and "should include" or "recommended" for optional things.

## What makes a good spec

**Be specific about required fields.** Don't say "include the usual frontmatter." Say which fields, what type, and what valid values are.

**Be specific about required sections.** Name the sections. State whether they need specific sub-structure.

**Include examples when the format is non-obvious.** If you expect a particular writing style or structure, show a short example inline in the spec.

**State what's explicitly not allowed.** The LLM will flag violations of negative constraints just as reliably as missing required elements.

## Spec file location

By default, the spec file is `README.md` in the directory it governs. You can change the filename via `validation.specFilePattern` in config — useful if you use READMEs for human documentation and want a separate `SPEC.md` for lint rules.

For cross-directory domains where one spec governs files across multiple directories, see [Cross-Directory Validation](/validation/cross-directory).

## See also

- [Validation Domains](/concepts/validation-domains)
- [Cross-Directory Validation](/validation/cross-directory)
- [praxis validate](/commands/validate)
