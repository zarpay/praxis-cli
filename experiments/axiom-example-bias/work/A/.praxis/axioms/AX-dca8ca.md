---
id: AX-dca8ca
version: 2
status: active
mode: judgment
scope: file
severity: error
derived_from: tests/README.md#one-assertion-per-block
introduced: 2026-09-02
---

Tests must separate distinct observable outcomes into separate it blocks — one outcome, one block. This rule judges block structure only; the quality of a block's description is outside its scope.

## Violating example

it('handles newsletter', () => {
  // Mixes return value, store state, and error case
  expect(sendNewsletter(...)).toBe(true);
  expect(store.listParlors()).toEqual(...);
  expect(() => sendNewsletter(...)).toThrow();
})

## Compliant example

describe('when subject is valid', () => {
  it('returns true', () => {
    expect(sendNewsletter(...)).toBe(true);
  })
  it('updates store state', () => {
    expect(store.listParlors()).toEqual(...);
  })
})
describe('when subject is empty', () => {
  it('throws an error', () => {
    expect(() => sendNewsletter(...)).toThrow();
  })
})
