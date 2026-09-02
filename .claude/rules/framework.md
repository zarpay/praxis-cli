---
description: What belongs in src/framework — the Praxis-agnostic kernel and CLI plumbing
paths:
  - cli/src/framework/**
---

# Framework

**The framework knows nothing about Praxis.** That is the test for whether something belongs here: file I/O, path math, the markdown document format, the error type, the output plumbing — primitives you could lift into any markdown-and-config CLI without bringing a single Praxis concept along. Anything that knows what a `.praxis/` directory is, what `config.json` means, or what a spec is, belongs to a domain.

This is the mini-framework a Praxis-shaped CLI is built from: primitives, the render kit (`views/`), the shapes its plumbing speaks in (`types.ts`), and the machinery that turns an orchestrator into a runnable command (`prepare-orchestrator.ts`).

The framework is not a domain and has no `models/`, `services/`, `orchestrators/` structure. A domain owns an area of the product and has a workflow and a way to show it; the framework has neither and never will. It sits below every domain, depends on nothing, and is depended on by everything (ESLint-enforced).

**Where the framework needs to know something Praxis-specific, it takes it as a parameter rather than importing it.** `prepareOrchestrator` is generic in its context and receives a factory; `domains/workspace/prepare-orchestrator.ts` binds it to `CommandContext`. That binding is the one place the plumbing meets the application, and it belongs to workspace because `workspace/models` already depends on the framework — importing it back would be a cycle.

- `types.ts` holds the framework's own vocabulary: display entries, error codes, `CommandRegistrar`, `CommandOutcome`, and the generic `Orchestrator<Ctx, Options>`. Praxis's cross-domain vocabulary (`ReviewerConfig`, `CohortMode`) stays in `src/types.ts`.

- `files.ts` and `paths.ts` are deliberately namespace modules, not services, and are the only files allowed to import `node:fs` and `node:path` — the ESLint rule names them, so splitting them into single-function services would trade a wall for scattered one-liners.
- `errors.ts` owns every error Praxis raises: one factory per failure mode, carrying a machine-readable code. Callers `throw errors.<name>(...)` and never build error strings.
- `files.ts` also holds the filename matching that goes with reading files —
  `hasGlobChars`, `matchesFilename(name, pattern)`, `isContentFile(path, metaPattern)`
  — as pattern math, not Praxis vocabulary. A domain asks its question by passing
  its own pattern: eval passes `specFilePattern` to ask "is this a target?", and
  the answer is the generic one, "is this content rather than a directory's meta
  file?".
- `markdown-file.ts` owns the document format. `MarkdownFile.at(path)` gives you `.body` and `.frontmatter`, and nothing else scans for `---`. A document _has_ frontmatter; `Frontmatter` is the metadata alone, never touching a path.
- **Frontmatter accessors validate.** `requiredString`, `optionalString`, `stringList` and `enumValue` raise on a wrong-shaped value, naming the document and the key. `parse()` is the unvalidated escape hatch.
