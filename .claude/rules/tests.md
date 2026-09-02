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
  broken on every directory move.
- `tests/helpers/` holds test-support utilities (not `.test.ts`); they
  coexist with the mirrored helper tests.
