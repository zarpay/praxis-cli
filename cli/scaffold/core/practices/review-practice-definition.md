---
title: Review Practice Definition
type: practice
---

# Review Practice Definition

> Check that the practice in front of you asks for judgment a reviewer can make by reading the target file.

## Objective

A practice tells a reviewer what to look for in each file it covers. If a criterion can be checked by a tool, the reviewer wastes effort on it. If a criterion has no reason behind it, the reviewer guesses at what counts. Keep the practice to judgment calls, and give each one a reason. Judge the one file in front of you.

## Process

1. Read each criterion. Ask whether a script could decide it. If yes, it is a lint rule.
2. Check that the practice says why each criterion matters.
3. Check for one example pair, one "do not" rule, and clear severity words.
4. Report each problem with the criterion it belongs to.

## Criteria

- [ ] **Every criterion is a judgment call.** A rule a script could check with no mistakes is lint and does not belong here. Two careful readers must be able to disagree about it. "Has a title" is lint. "The title says what the document is about" is a judgment.
- [ ] **Every criterion says why it matters.** A rule with a reason tells the reviewer what to look for. A bare rule leaves them guessing. "Error messages say what the user can do next" gives a reason. "Error messages are good" gives none.
- [ ] **The practice shows one example pair.** Somewhere in the practice, one case that passes sits next to one case that fails. The pair may live inside a criterion. "Enter a whole number from 1 to 5" passes. "Invalid input" fails. One pair is enough for the whole practice.
- [ ] **The practice says what is not allowed.** At least one criterion must say what to never do, using "never", "must not", or "do not". A reviewer only flags what the practice names.
- [ ] **Words set the severity.** Write a criterion as a command, or with "must", "never", or "always", when breaking it fails the file. Use "should" or "prefer" when breaking it is only a warning. Never mix both in one criterion.
- [ ] **Examples are written into the practice.** Never point to a live file as the example. That file will change and the example will drift. An example written here changes only when the practice does.
