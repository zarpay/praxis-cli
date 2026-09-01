---
description: What belongs in src/core — the kernel
paths:
  - cli/src/core/**
---

# Core

The kernel: primitives every domain uses — `base`, `config`, `errors`, `files`,
`frontmatter`, `frontmatter-fields`, `markdown-file`, `paths`, `spec-pattern`. It depends on no
domain and no command (ESLint-enforced), which is what lets everything depend on
it.

- `files.ts` and `paths.ts` are the only modules allowed to import `node:fs` and
  `node:path`. Everything else goes through their helpers.
- `errors.ts` owns every error Praxis raises: one factory per failure mode,
  carrying a machine-readable code. Callers `throw errors.<name>(...)` and never
  build error strings.
- `markdown-file.ts` owns the document format: `MarkdownFile.at(path)` gives you
  `.body` and `.frontmatter`, and nothing else scans for `---`. A document *has*
  frontmatter; `Frontmatter` is the metadata alone, built from the YAML between
  the fences and never touching a path or the filesystem.
- Add something here only when more than one domain needs it. A primitive one
  domain uses is that domain's service.
