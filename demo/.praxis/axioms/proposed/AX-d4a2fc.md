---
id: AX-d4a2fc
version: 1
status: proposed
mode: judgment
severity: error
introduced: 2026-09-09
---

A feature directory must contain exactly one entry point file named 'index.ts' that re-exports the feature's entire public API. Nothing outside the feature may import any other file in it.

## Violating example

A feature directory 'flavor-of-day' containing only 'flavor.ts' and 'old-rotation.ts' with no index.ts file.

## Compliant example

A feature directory 'flavor-of-day' containing 'index.ts' that exports the public API, along with 'flavor-of-day-types.ts' and 'get-flavor.ts'.
