# Writing Specs

A spec is an ordinary `README.md` file that doubles as a machine-readable specification. Writing a good spec is the most important part of making validation useful.

## The basic idea

When `praxis validate` runs, it sends two things to the LLM:

1. The spec file content
2. The document content

It then asks: *does this document comply with this spec?*

The LLM reads your spec as instructions. Write it clearly and specifically in human language — that is what makes the validation meaningful.

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

This spec tells the LLM exactly what to check: four frontmatter fields and two required markdown sections. A document missing any of those will get a FAIL or WARN.

## What makes a good spec

**Be specific about required fields.** Don't say "include the usual frontmatter." Say which fields, what type, and what valid values are.

**Be specific about required sections.** Name the sections. State whether they need specific sub-structure.

**Distinguish required from recommended.** The LLM respects that distinction. Use language like "must include" for required things and "should include" or "recommended" for optional things — the LLM will return WARN for missing recommended items and FAIL for missing required ones.

**Include examples when the format is non-obvious.** If you expect a particular writing style or structure, show a short example inline in the spec.

## Recommended vs required

```markdown
## Required

- `title` frontmatter field
- `## Scope` section with `### Responsible For` and `### Not Responsible For` subsections

## Recommended

- `## Authorities` section listing explicit permissions
- `description` field with a one-sentence summary
```

Documents missing a recommended item will receive a WARN (yellow) result. Documents missing a required item will receive a FAIL (red) result.

## Example: a responsibilities spec

```markdown
# Responsibilities

Each document in this directory describes one discrete unit of delegatable work.

## Required frontmatter

- `title` (string) — name of the responsibility in title case
- `type` (string) — must be `"responsibility"`

## Required sections

- `## Inputs` — what the agent receives when this responsibility is triggered
- `## Outputs` — what the agent produces when this responsibility completes
- `## Criteria` — the conditions under which this responsibility is considered done

## Guidelines

Keep each responsibility focused on one thing. If a document describes two distinct workflows, split it into two files.

Inputs and Outputs should use bullet lists. Criteria should use numbered steps or bullet points.
```

## Spec file location

By default, the spec file is `README.md` in the directory it governs. You can change the filename via `validation.specFilePattern` in config.

For cross-directory domains, the spec declares a `paths` frontmatter field. See [Cross-Directory Validation](/validation/cross-directory).

## See also

- [Validation Domains](/concepts/validation-domains)
- [Cross-Directory Validation](/validation/cross-directory)
- [praxis validate](/commands/validate)
