---
title: Review Service Quality
type: practice
---

# Review Service Quality

> Review changed services against the service conventions and report
> every deviation with the fix that would satisfy it.

## Objective

Keep every service readable by shape: a reviewer who has seen one
Scoop Society service has seen them all.

## Process

1. Read the changed service top to bottom
2. Check the module shape: one exported `run`, verb-first filename
3. Check behavior: validation first, Results for domain failures, no
   stray I/O, one responsibility
4. Check the doc comment: purpose plus every failure mode a caller
   must handle
5. Report each deviation with the concrete change that resolves it

## Criteria

- [ ] Every deviation names the convention it violates
- [ ] Every deviation includes the fix, not just the finding
- [ ] Error messages were read as an API consumer would read them
