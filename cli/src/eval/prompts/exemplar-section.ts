import type { AssistFile } from "@/eval/types.js";

/**
 * The EXEMPLARS prompt section: spec-blessed positive examples, shown
 * as labeled references and never reviewed (03). Empty string when the
 * spec blesses none, so the section vanishes from the prompt entirely.
 */
export default function exemplarSection(exemplars: readonly AssistFile[]): string {
  if (exemplars.length === 0) return "";

  const blocks = exemplars
    .map((e) => `===== EXEMPLAR: ${e.path} =====\n\n${e.content}`)
    .join("\n\n");

  return `## EXEMPLARS

The following files are spec-blessed positive examples. They are not
under review — use them as concrete references for what satisfying
the specification looks like.

${blocks}

`;
}
