# Cross-Directory Validation

By default, a spec file governs only the documents in its own directory. Cross-directory validation lets a single spec govern files anywhere in the project.

## The `paths` frontmatter field

Add a `paths` array to a spec file's YAML frontmatter to declare which files it validates:

```yaml
---
paths:
  - docs/**/*.md
  - guides/**/*.md
---

# Documentation Spec

All docs and guides must have a descriptive title and a summary paragraph...
```

Glob patterns are resolved against the project root. Any file matched by `paths` is validated against this spec, regardless of where the spec file itself lives.

## Example: a cross-team documentation standard

Suppose you have a technical writing standard that should apply to both `docs/` and `runbooks/`. Put the spec in a dedicated `specs/` directory:

```
specs/
└── README.md          ← governs docs/ and runbooks/
docs/
├── api-reference.md
└── deployment.md
runbooks/
├── incident-response.md
└── on-call-rotation.md
```

`specs/README.md`:

```yaml
---
paths:
  - docs/**/*.md
  - runbooks/**/*.md
---

# Technical Writing Standard

All documents in docs/ and runbooks/ must meet these criteria...
```

When `praxis validate all` runs, every file matched by those globs is validated against this spec — even though none of them live in `specs/`.

## Including `specs/` in sources

For Praxis to discover the spec, `specs/` must appear in your `sources` config:

```json
{
  "sources": ["roles", "responsibilities", "reference", "context", "specs"]
}
```

The spec file itself is excluded from validation (spec files are never validated against themselves).

## Multiple specs on the same document

A document can be validated by more than one spec simultaneously — for example, if it lives in a directory with its own local spec and is also matched by a cross-directory spec's `paths` glob.

Each (document, spec) pair is validated and cached independently. Both results appear in `praxis validate all` output.

::: tip Use sparingly
Cross-directory specs are powerful but can make validation coverage harder to reason about. Prefer local specs when documents are cohesive within a directory. Reach for `paths` when you have a genuine shared standard that spans multiple directories.
:::

## Configurable spec filename

If you use a naming convention other than `README.md` for your specs, set `specFilePattern` globally:

```json
{
  "validation": {
    "apiKeyEnvVar": "OPENROUTER_API_KEY",
    "model": "x-ai/grok-4.1-fast",
    "specFilePattern": "SPEC.md"
  }
}
```

Glob patterns work too:

```json
{ "specFilePattern": "*.spec.md" }
```

This applies to all spec discovery — both local and cross-directory.

## Excluding files from `paths`

Files prefixed with `_` and files that match the `specFilePattern` are always excluded from `paths` results, even if they match the glob. You do not need to add explicit exclusions for templates or spec files.

## See also

- [Validation Domains](/concepts/validation-domains)
- [Writing Specs](/validation/writing-specs)
- [Configuration](/reference/config)
