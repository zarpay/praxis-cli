---
title: Review Feature Cohesion
type: practice
owner: sundae
---

# Review Feature Cohesion

> Review a changed feature directory as one unit against the feature
> module conventions and report every deviation with its fix.

## Objective

Keep every feature a closed composition: one entry point, everything
reachable, one capability — so a reader who opens `index.ts` has the
whole feature in hand.

## Process

1. Read the directory's `index.ts` first — it defines the public API
2. Trace the import graph from `index.ts`; flag any file it never
   reaches (an orphan)
3. Check there is exactly one entry point and no deep imports from
   outside the feature
4. Check the parts: types in `<feature>-types.ts`, verb-first logic
   files following the service conventions
5. Ask whether the files serve one capability — if two, say where to
   split
6. Report each deviation with the concrete change that resolves it

## Criteria

- [ ] Every deviation names the convention it violates
- [ ] Orphan findings name the unreachable file and its likely home
- [ ] The one-capability review is argued from what the files do,
      not from their count
