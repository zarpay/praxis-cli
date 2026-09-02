import type { AssistFile } from "@/eval/types.js";

/**
 * The CONTEXT prompt section: assist-only reference files that inform
 * the review and never receive a verdict (03). Empty string when the
 * spec declares none, so the section vanishes from the prompt entirely.
 */
export default function contextSection(context: readonly AssistFile[]): string {
  if (context.length === 0) return "";

  const blocks = context.map((c) => `===== CONTEXT: ${c.path} =====\n\n${c.content}`).join("\n\n");

  return `## CONTEXT

The following files are reference context: what the specification's
subject matter is about. They are not under review and must not be
critiqued — use them only to inform your review.

${blocks}

`;
}
