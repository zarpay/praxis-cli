---
id: AX-a3e5a8
version: 1
status: proposed
mode: judgment
severity: error
introduced: 2026-09-09
---

A feature directory must contain a dedicated types file named '<feature>-types.ts' where all type definitions for that feature live.

## Violating example

A feature directory 'flavor-of-day' that defines types inline in 'flavor.ts' or has no types file at all.

## Compliant example

A feature directory 'flavor-of-day' containing 'flavor-of-day-types.ts' that houses all type definitions for the feature.
