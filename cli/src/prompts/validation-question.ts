import type { ValidationQuestionInput } from "@/types.js";

import { baseName, parentDir } from "@/helpers/paths-helper.js";
import axiomChecklistSection from "@/prompts/axiom-checklist-section.js";
import contextSection from "@/prompts/context-section.js";
import exemplarSection from "@/prompts/exemplar-section.js";

/**
 * The user prompt sent to the LLM for one review: specification, the
 * axiom checklist when one governs the spec, optional exemplar/context
 * sections, then the target under review — framed per file or per
 * cohort.
 */
export default function validationQuestion({
  specContent,
  targetContent,
  targetPath,
  kind,
  checklist,
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

${axiomChecklistSection(checklist)}${exemplarSection(exemplars)}${contextSection(context)}${subject}

\`\`\`
${targetContent}
\`\`\``;
}
