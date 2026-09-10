---
description: Where a type lives, what it is named, and when it earns the barrel
paths:
  - cli/src/**
---

# Types

**A global type is global because it is needed globally.** The barrel
(`src/types.ts`, re-exporting `src/types/*.ts`) holds the shared
vocabulary: types spoken by more than one module, or documented
external contracts (the config file's shape, the provider and plugin
interfaces, the `--json` report payloads). Everything else is declared
**in the module that speaks it, unexported** — a service's input and
result, an orchestrator's `Options`, a view's `Data`, a template's
vars. ESLint enforces the boundary the only way it can: an *exported*
type declaration outside `src/types/` is an error.

- **The domain files** (one topic each, cross-importing siblings by
  path, never the barrel): `shared` (Severity, RefKey, StoreProblem,
  GitFacts) · `app` (Orchestrator, Service, NoInput) · `config` (the
  config file's raw shape) · `review` (the eval loop: subjects,
  verdicts, critiques, units, diffs) · `extension-points` (provider and
  plugin contracts) · `spec-layer` (compile) · `ledger` (record shapes,
  05) · `axioms` (04) · `reports` (07's payloads). A new shared type
  goes in the file whose header sentence covers it; a new topic gets a
  new file and a barrel line.
- **Names read as families.** A type's name carries its parent:
  `CompilerPlugin` → `CompilerPluginOptions`; `VerdictReport` →
  `VerdictReportStatus`; `LedgerRunRecord` / `LedgerCritiqueRecord` /
  `LedgerDiffFacts`. Orphan names (`Options`, `Value`, `Status`,
  `Entry`) that lose their association are the failure mode this rule
  exists to prevent. The exception is **spec vocabulary** — `Verdict`,
  `Critique`, `Finding`, `Axiom*`, `Epoch` — which matches
  `praxis_v2_specs/vocabulary.md` exactly and is never renamed for
  symmetry.
- **Demotion and promotion are routine.** When a barrel type's
  consumers drop to one, it moves into that module (the
  consistency-audit skill checks the caller graph). When a local type
  gains a second consumer, it moves to the barrel — never import a type
  from another working module.
- Modules may declare local types freely, but a module is still
  behavior first: a long type block belongs above the code that uses
  it, after the imports, and stays unexported. The named exceptions
  that export beside their owner (`PraxisErrorCode` in errors-helper,
  `FSWatcher` in files-helper) are listed in the ESLint config.
- The framework package keeps its own barrel
  (`packages/framework/src/types.ts`) and never imports the app's.
