import type { ValidationQuestionInput } from "@/types.js";

import { baseName, parentDir } from "@/core/paths.js";
import contextSection from "@/prompts/context-section.js";
import exemplarSection from "@/prompts/exemplar-section.js";

/**
 * The user prompt sent to the LLM for one judgment: specification,
 * optional exemplar/context sections, then the target under judgment —
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

The following files form one unit (cohort). Judge them together as a
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
