# Validation Domains

A validation domain is a directory (or set of files) governed by a single spec. The spec is the lint rule; the domain is the scope it applies to.

## The rule

Any directory within your configured `sources` that contains a spec file (default: `README.md`) becomes a validation domain. Every `.md` file in that directory — excluding the spec itself and `_`-prefixed templates — is linted against that spec.

```
experts/
├── README.md          ← the lint rule for this domain
├── code-reviewer.md   ← linted against README.md
├── support-agent.md   ← linted against README.md
└── _template.md       ← skipped (template)
```

The same pattern works for any directory with organized documents — `app/services/`, `decisions/`, `api/specs/`. Any directory that has a README describing what valid documents look like can be a validation domain.

## The spec file

The spec file defines what the LLM should check. Write it in clear human language — the LLM reads it as instructions for a code reviewer who knows nothing else about the project:

```markdown
# Experts

Documents in this directory define agent experts.

## Required frontmatter

- `title` (string) — display name of the expert
- `type` (string) — must be `"expert"`
- `alias` (string) — short identifier used for compiled output
- `description` (string) — one-sentence summary of what the agent does

## Required sections

Every expert must have a `## Scope` section that contains both:

- A `### Responsible For` subsection
- A `### Not Responsible For` subsection
```

When `praxis eval run` runs, it sends this spec and the document content to each configured reviewer and asks whether the document conforms. The reviewer answers through a required tool call — pass, warn, or fail — with specific issues.

## Configurable spec file name

By default, the spec file is named `README.md`. You can change this globally with the top-level `specFilePattern` config key:

```json
{
  "specFilePattern": "SPEC.md"
}
```

Glob patterns are also supported, which is useful if specs live at different nesting levels:

```json
{ "specFilePattern": "*.spec.md" }
```

## Cross-directory domains

Spec files can declare a `paths` frontmatter field to govern files outside their own directory. This is useful when one lint rule should apply across multiple directories:

```yaml
---
paths:
  - docs/**/*.md
  - guides/**/*.md
---
# Documentation Standard

All docs and guides must have a title, a summary paragraph, and ...
```

The glob patterns are resolved against the project root. Any file matched by `paths` is linted against this spec regardless of where it physically lives.

::: tip When to use cross-directory domains
Use `paths` when the same quality standard applies across multiple directories — a "technical writing" spec that covers both `docs/` and `guides/`, or an "ADR format" spec that covers records spread across several team folders.
:::

## How multiple specs interact

A document can be linted by more than one spec — either because it lives in a directory with a local spec and is also matched by another spec's `paths` glob, or because multiple specs have overlapping `paths` patterns.

Each (document, spec) pair is validated and cached independently. The results are displayed separately in `praxis eval run`.

## See also

- [Writing Specs](/validation/writing-specs)
- [Cross-Directory Validation](/validation/cross-directory)
- [Caching](/validation/caching)
- [praxis eval run](/commands/eval)
