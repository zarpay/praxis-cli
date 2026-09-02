---
description: What belongs in a domain's models/ directory
paths:
  - cli/src/*/models/**
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
- **Every file here declares a class.** A module of loose functions over a
  domain _type_ is not a model, however domain-ish it reads — `verdict.ts` held
  two functions over the `Verdict` interface and is `worst-verdict-service.ts`
  now. The test is whether there is anything to construct.
- **A derivation from the model's own fields is a method here, not a service.**
  If a function's whole body reads nothing but one model's fields, it belongs on
  that model — `Reviewer.cacheIdentity()`, `ReviewSubject.assistProvenance()`,
  `SpecFile.assistPatterns()`. A service that a model is the only sensible caller
  of is a method wearing the wrong hat. An _algorithm_ the model uses stays a
  service and the model delegates to it (`hash-reviewer-service.ts`).

## `reviewer` is a noun

The configured instrument, never the action. It is fixed by the public surface —
`reviewers:` in `.praxis/config.json`, `--reviewer <name>`, and the `reviewer` field in
every committed cache entry — so the verb had to give way instead.

The verb is **review**: `review-target-service.ts`, `provider.review(request)`,
`reviewNamed`. Write "the reviewer reviews a target", never "reviewers" it.
