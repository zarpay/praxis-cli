import type { PracticeTemplateVars } from "@/types.js";

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

## Inputs

- Input 1: Where to find it
- Input 2: Where to find it

## Outputs

- Output 1: Format and destination
- Output 2: Format and destination

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
