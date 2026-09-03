# Cross-Directory Review

By default, a spec file governs only the documents in its own directory. Cross-directory review lets a single spec govern files anywhere in the project — which is also how a spec governs *code*: Scoop Society's `src/services/README.md` targets `src/services/*.ts` with a `paths:` glob.

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

## The `cohort` frontmatter field

By default (`cohort: by_file`, usually omitted), each file matched by `paths` is evaluated on its own. Set `cohort: by_directory` to make `paths` match _directories_ instead — each matched directory becomes **one evaluation unit**: every file it contains is evaluated together in a single call, receiving a single verdict cached against the member set.

```yaml
---
paths:
  - "src/features/*"
cohort: by_directory
---
# Feature Directory Spec

Every feature directory hangs together: one entry point, no orphaned
files, tests beside what they test...
```

Here each first-layer directory under `src/features/` is evaluated as a set — the shape for relational standards ("no orphans," "one entry point per namespace") that no single file can answer. Editing any member file invalidates that directory's cached verdict. An unknown `cohort` value fails with an error listing the accepted options.

`paths` and `cohort` combine with the scoping keys `excludes:`, `exemplars:`, and `context:` — see [Writing Specs — Scoping frontmatter](/validation/writing-specs#scoping-frontmatter).

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

When `praxis eval run` runs, every file matched by those globs is reviewed against this spec — even though none of them live in `specs/`.

## Including `specs/` in sources

For Praxis to discover the spec, `specs/` must appear in your `sources` config:

```json
{
  "sources": ["experts", "practices", "reference", "context", "specs"]
}
```

The spec file itself is never a review target (specs are never reviewed against themselves).

## Multiple specs on the same document

A document can be reviewed by more than one spec simultaneously — for example, if it lives in a directory with its own local spec and is also matched by a cross-directory spec's `paths` glob.

Each (document, spec) pair is reviewed and cached independently. Both results appear in `praxis eval run` output.

::: tip Use sparingly
Cross-directory specs are powerful but can make review coverage harder to reason about. Prefer local specs when files are cohesive within a directory. Reach for `paths` when you have a genuine shared standard that spans multiple directories.
:::

## Configurable spec filename

If you use a naming convention other than `README.md` for your specs, set the top-level `specFilePattern` key:

```json
{
  "specFilePattern": "SPEC.md"
}
```

Glob patterns work too:

```json
{ "specFilePattern": "*.spec.md" }
```

This applies to all spec discovery — both local and cross-directory.

## Excluding files from `paths`

Files prefixed with `_` and files matching the `specFilePattern` are always excluded from `paths` results, even when the glob matches them — as is anything in the config's `ignore` patterns or the spec's own `excludes:`. You never need explicit exclusions for templates or spec files.

## See also

- [Review Domains](/concepts/validation-domains)
- [Writing Specs](/validation/writing-specs)
- [Configuration](/reference/config)
