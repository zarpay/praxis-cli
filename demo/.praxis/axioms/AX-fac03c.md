---
id: AX-fac03c
version: 1
status: active
mode: judgment
scope: file
severity: error
grounded_in: src/features/README.md#structure
introduced: 2026-09-03
---

Error messages in logic files must be consumer-grade: clear about what went wrong and actionable about how to fix it, rather than technical codes or terse labels.

## Violating example

A logic file `flavor.ts` that exports multiple functions like `getFlavor()` and `setFlavor()`, throws exceptions directly, and returns error messages like 'ERR_INVALID_INPUT'.

## Compliant example

A logic file `get-flavor.ts` that exports a single `run` function, returns `Result<Flavor>`, and provides error messages like 'No flavor found for the specified date. Please provide a date within the current rotation period.'
