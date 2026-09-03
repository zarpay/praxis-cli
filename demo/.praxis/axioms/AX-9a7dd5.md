---
id: AX-9a7dd5
version: 1
status: active
mode: judgment
scope: file
severity: error
grounded_in: tests/README.md#subject-framing
introduced: 2026-09-02
---

Each it block's description must read as a complete sentence describing the specific behavior being tested when combined with its describe context, using plain language that communicates observable outcomes rather than vague placeholder names.

## Violating example

it('works', () => { ... })

## Compliant example

it('returns true', () => { ... }) or it('fails with an error naming the unknown id', () => { ... })
