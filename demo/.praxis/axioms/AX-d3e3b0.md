---
id: AX-d3e3b0
version: 1
status: active
mode: judgment
scope: file
severity: error
grounded_in: src/features/README.md#cohesion
introduced: 2026-09-03
---

All files in a feature directory must serve the same single capability. If files serve two unrelated purposes, they belong in separate features. This ensures each feature has clear boundaries and a focused purpose.

## Violating example

A `flavor-of-day` feature that contains both `get-current-flavor.ts` (determines today's flavor) and `old-rotation.ts` (legacy rotation system serving a different purpose or kept as dead code).

## Compliant example

A `flavor-of-day` feature where all files (`get-flavor.ts`, `announce-flavor.ts`, `flavor-of-day-types.ts`) work together to support the single capability of determining and announcing the current day's flavor.
