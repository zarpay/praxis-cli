---
title: Testing Philosophy
type: convention
---

# Testing Philosophy

A Scoop Society test is a claim about functionality, stated so plainly
that the suite doubles as documentation. Three commitments follow:

**Tests read as sentences.** Subject (`describe`), situation (nested
`when ...` describe), outcome (`it`). If the sentence is awkward, the
test boundary is wrong — fix the framing, not the grammar.

**One assertion per block.** A block that asserts two things hides
which one failed. The second outcome gets its own block; compound
shapes are asserted once with a single matcher.

**Functionality over implementation.** Tests call the public API and
assert on what a caller could observe. A refactor that preserves
behavior must never break a test — if it does, the test was coupled to
implementation, and the test is what gets fixed.
