# tests/ — one mirror per module

`tests/<path>.test.ts` covers `src/<path>.ts` and tests its public
interface only; `tests/integration/` is the one non-mirroring
exception; `tests/helpers/` holds the shared fixture factories
(`testConfig`, `seedLedgerRun`, `seedAxiom`, the scripted OpenRouter
server) — domain fixtures are factories, never per-file literals.
Stores test on real tmpdirs; git behavior tests on real repos; HTTP
mocks via MSW only.

Rule: `.claude/rules/tests.md`.
