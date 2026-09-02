---
title: Feature Modules
type: convention
---

# Feature Modules

A feature is the unit of capability in Scoop Society: a directory that
composes domain logic into one thing a user can do. Three commitments:

**One door.** Every feature has exactly one entry point, `index.ts`,
re-exporting its entire public API. Consumers import the feature, not
its internals — which keeps refactors inside a feature invisible
outside it.

**Nothing stranded.** Every file in the directory is reachable from
the entry point. An unreachable file is either dead (delete it) or
misplaced (move it). This is a property of the set, which is why
features are reviewed as one unit.

**One capability.** A feature's name says what a user can do
(`tasting-menu`, `awards`). When a directory accumulates a second
purpose, it becomes a second feature.
