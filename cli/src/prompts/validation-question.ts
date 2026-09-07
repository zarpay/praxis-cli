import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The user prompt sent to the LLM for one review: specification, the
 * optional exemplar/context sections, then the target under review —
 * framed per file or per cohort.
 *
 * `exemplarSection`/`contextSection` arrive pre-rendered (or empty, so
 * the section vanishes) and `subject` is file-subject or cohort-subject
 * rendered — the caller composes; this template fixes the frame.
 */
interface ValidationQuestionVariables {
  /** The spec content the target is reviewed against. */
  specContent: string;
  /** Rendered exemplar-section, or "" when the spec blesses none. */
  exemplarSection: string;
  /** Rendered context-section, or "" when the spec declares none. */
  contextSection: string;
  /** Rendered file-subject or cohort-subject. */
  subject: string;
  /** The review input: one file's content, or an assembled cohort. */
  targetContent: string;
}

const TEMPLATE = `## SPECIFICATION

\`\`\`
{specContent}
\`\`\`

{exemplarSection}{contextSection}{subject}

\`\`\`
{targetContent}
\`\`\``;

const validationQuestion: Prompt<ValidationQuestionVariables> = preparePrompt(TEMPLATE);

export default validationQuestion;
