/** What `praxis add practice` supplies to the practice document template. */
interface PracticeTemplateVars {
  /** Display title, e.g. "Review Pull Requests". */
  title: string;
}

/**
 * The document `praxis add practice <name>` writes.
 *
 * The title is the only variable: a practice's frontmatter carries
 * nothing else the CLI can fill in.
 */
export default function practiceFileTemplate({ title }: PracticeTemplateVars): string {
  return `---
title: "${title}"
type: practice
---

# ${title}

> One-sentence description of what this practice accomplishes.

## Objective

What does this practice achieve? Why does it matter?

## Process

1. First, do X
2. Then, do Y
3. Finally, do Z

## Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
`;
}
