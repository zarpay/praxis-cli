---
name: demo-audit
description: Run the end-to-end feature audit against the demo (Scoop Society) using the expectation matrix in demo/EXPECTATIONS.md — the acceptance test for every feature and every milestone.
---

# Demo Audit — the role-play

The demo (`demo/`, Scoop Society) is the live testbed: real specs, real
axioms, a committed ledger of real evidence, three reviewers (one
offline). This skill runs the CLI's whole command surface against it and
judges every output against `demo/EXPECTATIONS.md` — the maintained
feature/expectation matrix. Offline tests prove units; this proves the
product.

## When to run

- **Always** after a milestone's implementation, before the merge ask.
- **Targeted** after any change touching the eval loop, ledger, cache,
  reviewer identity, or a command's output — run the affected matrix
  sections plus the canary.
- The canary alone (`step 2`) after *any* src change, however small.

## Procedure

1. **Build**: `cd cli && npm run build`. The demo consumes `file:../cli`.
2. **Canary first**: from `demo/`,
   `npx praxis eval run --reviewer counter` → must be **all cache hits,
   zero misses, zero errors**. A single miss means the reviewer's
   behavioral hash changed — an epoch event. Stop and investigate: if
   the change was deliberate (prompt/config edit), say so and expect the
   owner's confirmation; if not, it's a bug.
3. **Work through `demo/EXPECTATIONS.md` top to bottom**, matching each
   command's real output against its row. Honor the legend:
   - **[free]** rows always run.
   - **[paid]** rows need the OpenRouter key in the environment (it is
     not in the repo; the owner's setup provides it — check project
     memory or ask). Costs are pennies; prefer `v32` where a completed
     live verdict matters (flash's known JSON quirk is in the matrix).
   - **[scratch]** rows run in a copy
     (`cp -r demo <scratchpad>/audit-demo`), never against the real
     demo — they consume triage state or spend curator money.
4. **For a new feature**: exercise it beyond the matrix — realistic
   inputs, a failure path, a rerun. The role-plays that found M4's
   all-hit blindness and M5's flow erasure went off-script deliberately.
5. **Judge like a reviewer, not a test runner.** An output can exit 0
   and still be wrong: a blank section, a misleading badge, a count that
   contradicts another surface. Read what a user would read.
6. **Close out**:
   - Final canary run.
   - Commit the demo's new ledger evidence (`demo/.praxis/ledger/`) —
     runs are evidence by design (spec 10-k).
   - Update `EXPECTATIONS.md` rows the feature legitimately changed —
     matrix and behavior move in the same commit.
   - Report findings honestly: what passed, what surprised, what was
     fixed, what is deferred.

## Failure discipline

A live failure is a finding, not an embarrassment: verify it is not a
regression (run the previous build or a worktree of the prior commit
against the same state), locate the semantics gap, fix it with a dated
spec note, and pin it with a regression test — then re-run the affected
rows.
