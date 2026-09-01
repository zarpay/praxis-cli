import type { ValidationQuestionInput } from "@/domains/eval/types.js";

import { baseName, parentDir } from "@/core/paths.js";
import contextSection from "@/domains/eval/prompts/context-section.js";
import exemplarSection from "@/domains/eval/prompts/exemplar-section.js";

/**
 * The user prompt sent to the LLM for one review: specification,
 * optional exemplar/context sections, then the target under review —
 * framed per file or per cohort.
 */
export default function validationQuestion({
  specContent,
  targetContent,
  targetPath,
  kind,
  exemplars,
  context,
}: ValidationQuestionInput): string {
  const subject =
    kind === "cohort"
      ? `## FILES TO VALIDATE

The following files form one unit (cohort). Review them together as a
set against the specification; each file is labeled with its path.

Cohort: ${targetPath}`
      : `## FILE TO VALIDATE

File: ${baseName(targetPath)}
Directory: ${parentDir(targetPath)}`;

  return `## SPECIFICATION

\`\`\`
${specContent}
\`\`\`

${exemplarSection(exemplars)}${contextSection(context)}${subject}

\`\`\`
${targetContent}
\`\`\``;
}
