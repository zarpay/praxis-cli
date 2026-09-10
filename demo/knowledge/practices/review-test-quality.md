---
title: Review Test Quality
type: practice
---

# Review Test Quality

> Review changed test suites against the test conventions and report
> every deviation with the rewrite that would satisfy it.

## Objective

Keep every suite readable as a sentence and immune to refactors that
don't change behavior: a test should only ever fail because the
functionality it names actually broke.

## Process

1. Read each changed `it` block with its enclosing describes as one
   sentence — flag any that don't read as a claim about behavior
2. Count the `expect` calls per `it` block — exactly one
3. Check what each assertion touches: public API in, returned values
   and observable state out — flag spies, call counts, and reaches
   into internals
4. Check isolation: data built fresh per test, no ordering dependence
5. Report each deviation with the concrete rewrite that resolves it

## Criteria

- [ ] Every deviation names the convention it violates
- [ ] Every deviation includes the rewrite, not just the finding
- [ ] Each flagged test was reviewed by what would make it fail, not by
      how it looks
