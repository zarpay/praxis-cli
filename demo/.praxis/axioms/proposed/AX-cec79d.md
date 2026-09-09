---
id: AX-cec79d
version: 1
status: proposed
mode: judgment
severity: error
introduced: 2026-09-09
---

Every file in a feature directory must be reachable from index.ts through its import graph. Files that are not imported (directly or transitively) by the entry point are orphaned and violate feature cohesion.

## Violating example

A feature directory with index.ts that imports 'get-flavor.ts', but also contains 'old-rotation.ts' which is never imported by index.ts or any file it imports.

## Compliant example

A feature directory where index.ts imports 'get-flavor.ts', which in turn imports 'flavor-of-day-types.ts', making all files reachable through the import graph.
