/** What `praxis add practice` supplies to the practice document template. */
interface PracticeTemplateVars {
  /** Display title, e.g. "Review Pull Requests". */
  title: string;
}

/**
 * The document `praxis add practice <name>` writes.
 *
 * The title is the only variable: a practice's frontmatter carries
 * nothing else the CLI can fill in. Every `{token}` is guidance the
 * author replaces by hand. The shape is the one the scaffold's recruiter
 * reviews for: criteria that are judgment calls, each with its reason,
 * one pass/fail pair, and at least one "never".
 */
export default function practiceFileTemplate({ title }: PracticeTemplateVars): string {
  return `---
title: "${title}"
type: practice
---

# ${title}

> {One sentence: what this practice asks a reviewer to judge about the file in front of it.}

## Objective

{Why this matters. What goes wrong when a file misses the standard. Two or three short sentences.}

## Process

1. {Read the file as the person it is written for.}
2. {Look for the things the criteria name.}
3. Report each problem with the passage it belongs to.

## Criteria

- [ ] **{A judgment a careful reader could disagree about, written as a command.}** {Why it matters.} "{A case that passes}" passes. "{A case that fails}" fails.
- [ ] **{Another judgment.}** {Why it matters.} Never {what is not allowed}.
- [ ] **{A judgment that only warns, written with "should".}** {Why it matters.}
`;
}
