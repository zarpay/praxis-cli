import type { AssistFile } from "@/types.js";

import { baseName, parentDir } from "@/helpers/paths-helper.js";
import contextSection from "@/prompts/context-section.js";
import exemplarSection from "@/prompts/exemplar-section.js";

/** Everything the reviewer's user prompt is built from. */
interface ValidationQuestionInput {
  /** The spec content the target is reviewed against. */
  specContent: string;
  /** The review input: one file's content, or an assembled cohort. */
  targetContent: string;
  /** Path of the file, or of the cohort's directory. */
  targetPath: string;
  /** Whether the target is one file or a pre-assembled cohort of files. */
  kind: "file" | "cohort";
  /** Spec-blessed positive examples, inlined and never reviewed. */
  exemplars: readonly AssistFile[];
  /** Assist-only reference files, inlined and never reviewed. */
  context: readonly AssistFile[];
}

/**
 * The user prompt sent to the LLM for one review: specification, the
 * optional exemplar/context
 * sections, then the target under review — framed per file or per
 * cohort.
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
