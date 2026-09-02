---
id: AX-96ff9c
version: 1
status: active
mode: judgment
scope: file
severity: error
grounded_in: src/features/README.md#structure
introduced: 2026-09-02
---

A feature's entry point must re-export the feature's entire public API.

## Violating example

A feature directory 'flavor-of-day' containing files like 'flavor.ts' and 'old-rotation.ts' but no 'index.ts' file.

## Compliant example

A feature directory 'flavor-of-day' with an 'index.ts' file that exports all public functionality: `export * from './flavor-of-day-types'; export { run } from './get-flavor';`
