import type { AssistFile, ChecklistAxiom } from "@/types.js";

import { baseName, parentDir } from "@/helpers/paths-helper.js";
import axiomChecklistSection from "@/prompts/axiom-checklist-section.js";
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
  /** The active axioms grounded in this spec — the checklist channel (04). */
  checklist: readonly ChecklistAxiom[];
  /** Spec-blessed positive examples, inlined and never reviewed. */
  exemplars: readonly AssistFile[];
  /** Assist-only reference files, inlined and never reviewed. */
  context: readonly AssistFile[];
}

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
