---
description: What a test file is — a mirror of one module's public promise
paths:
  - cli/tests/**
  - cli/packages/framework/tests/**
---

# Tests

**A test file mirrors exactly one module and tests its public interface.**
`tests/<path>.test.ts` covers `src/<path>.ts`; the framework package's tests
live in `packages/framework/tests/`, mirroring its `src/`. The one sanctioned
exception is `tests/integration/`, which exercises whole flows and mirrors
nothing.

**Mirroring is complete, and the gaps are named.** Every module in a
layer that *behaves* has a mirrored test: `services/`, `views/`,
`orchestrators/`, `models/`, `stores/`, `helpers/`, `templates/`,
`providers/`, `plugins/`, and the framework kit. Two layers are exempt
because they declare rather than behave, and their contracts are held
elsewhere:

- **`commands/`** is route declarations — `.option()` chains handed to
  `.action(orchestrator)`, with no logic to exercise. A test here tests
  commander. What it could get wrong — a flag whose name stops matching
  its orchestrator's `Options` — is not type-checked, and is caught by
  the orchestrator's own tests and the demo run.
- **`prompts/`** is one `const TEMPLATE` per file. A test would assert a
  string against itself. The machinery is covered by
  `prepare-prompt-helper`, and the reviewer-facing text is pinned by
  `prompt-surface` and the reviewer hash, where changing a word is an
  epoch event rather than a test failure.

Anything else without a mirrored test is a gap, not a decision. The
consistency-audit skill counts them per layer, so the number is visible
rather than discovered.

- **Test the promise, not the implementation.** A service is one input → one
  output: call it with a literal, assert on the result. A model is a class:
  test its public methods and constructor validation. A view returns entries:
  assert on the entries, never on captured stdout. Never test private methods
  or module-private helpers — if a helper deserves direct tests, that is the
  signal it wants to be a service or a model method.
- **A file that tests two modules is two files.** Coverage for something a
  refactor absorbs moves with it, expressed through the surviving public
  surface (`assistHashInput`'s cases became `ReviewSubject.contentHash()`
  distinctness tests).
- **Describe blocks name public exports or behaviors**, not internals: a
  `describe("summary()")` for a private function is a rename waiting to
  mislead someone.
- **Boundary mocks only:** MSW for HTTP, `vi.mock("node:child_process")` for
  spawning, a `Writable` stream for `Logger`, a `console.log` spy only for
  `Display` — the one module whose contract _is_ stdout. Never mock a
  project-internal module.
- Fixtures: build throwaway projects with the `@tests/helpers/*` tmpdir
  builders; never compute paths by counting `..` past one level — that has
  broken on every directory move. The config a service or store needs is
  `testConfig(root, overrides)` (`@tests/helpers/test-config`) — assembled in
  memory, so overriding one field never means writing a config file.
- **Domain fixtures are shared factories, not per-file literals.** An axiom
  document is `axiomContent`/`seedAxiom` (`@tests/helpers/axiom-fixtures`); a
  ledger record is `seedLedgerRun`/`critiqueLine` (`@tests/helpers/ledger-runs`).
  A test file that redeclares one of these shapes inline is duplicating a
  contract nine other files already depend on — extend the factory's overrides
  instead. Local wrappers that pin a suite's defaults (`guideCritique`,
  `matchedCritique`) are encouraged; local re-implementations are not.
- `tests/helpers/` holds test-support utilities (not `.test.ts`); they
  coexist with the mirrored helper tests.
