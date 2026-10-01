---
title: Review Expert Definition
type: practice
---

# Review Expert Definition

> Check that the expert definition in front of you tells a reviewer which files it covers and how to read them, and leaves the detailed checks to its practices.

## Objective

An expert definition sets the frame. It names the files the expert reviews and says what the reviewer cares about when reading them. The detailed checks live in the practices it declares. When an expert turns into a list of checks, the reviewer reads the checks twice and the two copies drift apart. When an expert is vague about its scope, the reviewer invents checks to fill the gap. Judge the one file in front of you. You do not need to see its practices to do this.

## Process

1. Read the `description`. Does it say when to use this expert?
2. Compare `validates:` with the body. Do they cover the same files?
3. Read the body. Does it give a point of view, or a list of checks?
4. Report each problem with the sentence it belongs to.

## Criteria

- [ ] **The description says when to use the expert.** A tool reads this line to decide when to call the expert. "Reviews the runbooks" fails, because it only says what the expert does. "Use when a file under docs/runbooks/ changes" passes, because it says when.
- [ ] **An expert that reviews files declares `validates:`, and it matches the body.** If `validates:` is wider than the body, the reviewer invents checks for the extra files. If it is narrower, files go unreviewed. An expert that only answers questions declares none.
- [ ] **Files outside the scope go under `excludes:`.** Never write "except for X" in the body. A file under `excludes:` is one the reviewer never sees. A sentence in the body can be missed.
- [ ] **The body says who the reader is and what they care about.** This gives the reviewer a point of view. "Documents must be current" is a check. "The reader was not there when this was built and has only this document" is a point of view.
- [ ] **The body is a point of view, never a list of checks.** A body that lists the things it will check for must fail. Those belong in a practice, where the reviewer reads them once.
- [ ] **The body holds nothing a tool could check.** Required fields and naming patterns are lint. They add words and give the reviewer nothing to judge.
