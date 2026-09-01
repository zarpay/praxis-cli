---
description: What belongs in src/core — the Praxis-agnostic kernel
paths:
  - cli/src/core/**
---

# Core

**Core knows nothing about Praxis.** That is the test for whether something belongs here: file I/O, path math, the markdown document format, the error type, the output plumbing — primitives you could lift into any markdown-and-config CLI without bringing a single Praxis concept along. Anything that knows what a `.praxis/` directory is, what `config.json` means, or what a spec is, belongs to a domain.

Core is not a domain and has no `models/`, `services/`, `orchestrators/`, `views/` structure. A domain owns an area of the product and has a workflow and a way to show it; core has neither and never will. It sits below every domain, depends on nothing, and is depended on by everything (ESLint-enforced).

- `files.ts` and `paths.ts` are deliberately namespace modules, not services, and are the only files allowed to import `node:fs` and `node:path` — the ESLint rule names them, so splitting them into single-function services would trade a wall for scattered one-liners.
- `errors.ts` owns every error Praxis raises: one factory per failure mode,
  carrying a machine-readable code. Callers `throw errors.<name>(...)` and never
  build error strings.
- `markdown-file.ts` owns the document format. `MarkdownFile.at(path)` gives you
  `.body` and `.frontmatter`, and nothing else scans for `---`. A document *has*
  frontmatter; `Frontmatter` is the metadata alone, never touching a path.
- **Frontmatter accessors validate.** `requiredString`, `optionalString`,
  `stringList` and `enumValue` raise on a wrong-shaped value, naming the document
  and the key. `parse()` is the unvalidated escape hatch.
