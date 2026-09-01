---
description: What belongs in a domain's models/ directory
paths:
  - cli/src/domains/*/models/**
---

# Models

**A model is a model**, in the ordinary sense: a **noun**, named for the thing it represents — `spec-file.ts`,
`expert-file.ts`, `reviewer.ts`, `review-target.ts`. Never a verb. It is a class:
the data plus the helpers on that data, and the one place a document kind's
frontmatter keys are spelled.

- **Validate on construction.** A model that exists is a valid document. Read
  every field through a `Frontmatter` accessor (`requiredString`, `stringList`,
  `enumValue`), which raises on a missing required key or a wrong-shaped value,
  so no consumer re-checks.
- Absence and invalidity differ: an omitted optional key is `undefined` (or `[]`),
  a key that is present but malformed raises.
- A model reads its own file and nothing else — no network, no writing, no
  coordinating other work. Resolving a path against a project root is a caller's
  job, not a parser's.
- Callers that sweep a directory catch per file and report, so one malformed
  document never takes down a batch.

## `reviewer` is a noun

The configured instrument, never the action. It is fixed by the public surface —
`reviewers:` in `.praxis/config.json`, `--reviewer <name>`, and the `reviewer` field in
every committed cache entry — so the verb had to give way instead.

The verb is **evaluate**, matching the domain and `praxis eval run`:
`evaluateTarget`, `provider.evaluate(request)`, `isTarget`. Write "the reviewer
evaluates a target", never "reviewers" it.
