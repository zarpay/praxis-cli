---
paths:
  - "tests/*.test.ts"
---

# Test Conventions

Tests are the executable description of what Scoop Society does. They
are read more often than they are written, so every suite follows the
same three rules.

## Subject framing

- The top-level `describe` names the unit under test by its module
  name: `describe("create-review", ...)`.
- Nested `describe` blocks name the situation, written as a `when`
  clause: `describe("when the parlor does not exist", ...)`.
- Each `it` states one observable outcome in plain language, so that
  `describe` + `it` reads as a sentence: *create-review, when the
  parlor does not exist, fails with an error naming the unknown id.*

## One assertion per block

- Every `it` block contains exactly one `expect`. A second outcome
  worth asserting is a second `it` block under the same `describe`.
- Compound shapes are asserted once with `toMatchObject`/`toEqual`
  rather than field-by-field across multiple expects. This rule applies
  within a block: separate blocks may naturally assert similar shapes,
  since each states its own outcome.

## Functionality, not implementation

- Tests exercise the unit's public API only — for services, the
  exported `run` function — and assert on returned values and
  observable state, never on internals. State observed through the
  unit's injected collaborators (e.g. reading the Store after a run)
  is functionality, not implementation: a caller could observe it too.
- No spies on call counts, no mocking of collaborators that have
  honest in-memory implementations, no reaching into module scope.
  If a test breaks when a body is refactored without a behavior
  change, the test was wrong.
- Test data is built fresh inside each test or its `describe` setup;
  suites never depend on each other's state or ordering.
