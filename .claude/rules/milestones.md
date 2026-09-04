---
description: How a v2 milestone is planned, built, verified, and landed
paths:
  - cli/**
---

# Milestones

**A milestone is a spec-to-demo arc, and every stage leaves the tree
green.** M2 (critique flow), M3 (axioms), M4 (measurement), and M5
(diff units) all landed this way; the next one should too.

1. **Plan against the specs.** The requirements live in
   `cli/praxis_v2_specs/` and the buildable rows in `EXECUTION.md`.
   Design forks that are genuinely the owner's call are put to him as
   concrete options with a recommendation — he decides quickly and
   decisively. Everything else is decided in the plan, grounded in a
   spec section, and recorded.
2. **Branch off `v2`** (`m<N>-<name>`). `main` stays on the 1.4.x line
   until v2 releases; milestone branches merge back into `v2` only when
   the owner says merge.
3. **Build in stages, full gate per stage**: `npm run lint`,
   `typecheck`, prettier, `npx vitest run`, `npm run build` — all from
   `cli/`. Tests mirror one-to-one and land with the stage, not after.
4. **Specs are updated in the same milestone.** Implementation decisions
   that resolve or supersede spec text are written into the spec *with
   their date* (house style: "decided 2026-09-04"), open questions get
   struck through with their resolution, and the `EXECUTION.md` rows
   flip with the gap named when partial. A spec that lags the code is a
   bug.
5. **Site docs are part of done** (`site/`): the affected pages update
   in the milestone branch so docs and implementation merge together.
   The running example is Scoop Society — keep it consistent.
6. **The demo role-play is the acceptance test.** Exercise the new
   feature end-to-end on `demo/` with a real reviewer (see the
   `demo-audit` skill and `demo/EXPECTATIONS.md`), plus the canary: a
   corpus run with the offline `counter` reviewer must stay all cache
   hits — any miss means reviewer identity changed, which is an epoch
   event that must be deliberate, never incidental. Commit the demo's
   new ledger evidence (10-k).
7. **Live contact finds what tests cannot.** Budget for it: M4's
   all-hit debt blindness, M5's flow-erasure on replays and the
   flash-JSON quirk all surfaced only in the role-play. Fix, spec the
   fix with a date, and add the regression test before merging.

**Design style for spec work** (learned corrections, not preferences):
patterns over datapoints — instance data is a hypothesis, never the
design; minimal machinery — if a principle is one sentence, do not
build states and ceremonies around it; identifiers minted by
distributed contributors are **random, never sequential** — check every
new id scheme against the two-branches-merge case.
