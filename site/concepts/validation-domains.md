# Validation Domains

A validation domain is a directory (or a set of files) governed by a single spec. Understanding how domains are discovered and how they match documents to specs is the foundation of `praxis validate`.

## The rule

Any directory within your configured `sources` that contains a spec file (default: `README.md`) becomes a validation domain. Every `.md` file in that directory — excluding the spec itself and `_`-prefixed templates — is validated against that spec.

```
roles/
├── README.md          ← spec for this domain
├── code-reviewer.md   ← validated against README.md
├── support-agent.md   ← validated against README.md
└── _template.md       ← skipped (template)
```

## The spec file

The spec file is an ordinary README that doubles as a machine-readable specification. It tells the LLM what valid documents in that directory look like:

```markdown
# Roles

Documents in this directory define agent roles.

## Required frontmatter

- `title` (string) — display name of the role
- `type` (string) — must be `"role"`
- `alias` (string) — short identifier used for compiled output
- `description` (string) — one-sentence summary of what the agent does

## Required sections

Every role must have a `## Scope` section that contains both:
- A `### Responsible For` subsection
- A `### Not Responsible For` subsection

## Optional

- `## Authorities` — explicit permissions the role holds
```

When `praxis validate` runs, it sends this spec along with the document content to an LLM and asks whether the document conforms. The LLM returns Yes / Maybe / No with specific issues.

## Configurable spec file name

By default, the spec file is named `README.md`. You can change this globally in your validation config:

```json
{
  "validation": {
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "model": "x-ai/grok-4.1-fast",
    "specFilePattern": "SPEC.md"
  }
}
```

Glob patterns are also supported, which is useful if specs live at different nesting levels:

```json
{ "specFilePattern": "*.spec.md" }
```

## Cross-directory domains

Spec files can declare a `paths` frontmatter field to govern files outside their own directory. This is useful when one spec should cover a spread of files across multiple directories.

```yaml
---
paths:
  - docs/**/*.md
  - guides/**/*.md
---

# Documentation Spec

All docs and guides must have a title, a summary paragraph, and ...
```

The glob patterns are resolved against the project root. Any file matched by `paths` is validated against this spec, regardless of where it physically lives.

::: tip When to use cross-directory domains
Use `paths` when the same quality standard applies across multiple directories — for example, a "technical writing" spec that covers both `docs/` and `guides/`, or a "decision record" spec that covers records spread across several team folders.
:::

## How multiple specs interact

A document can be validated by more than one spec — either because it lives in a directory with a local spec and is also matched by another spec's `paths` glob, or because multiple specs have overlapping `paths` patterns.

Each (document, spec) pair is validated and cached independently. The results are displayed separately in `praxis validate all`.

## See also

- [Writing Specs](/validation/writing-specs)
- [Cross-Directory Validation](/validation/cross-directory)
- [Caching](/validation/caching)
- [praxis validate](/commands/validate)
