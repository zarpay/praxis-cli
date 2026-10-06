import type { Prompt } from "@framework/types.js";

import { preparePrompt } from "@/helpers/prepare-prompt-helper.js";

/**
 * The user prompt sent to the LLM for one review: specification, the
 * optional context section, then the target under review — framed per
 * file or per cohort.
 *
 * The specification is the spec's body: a reviewer is shown the
 * standard, never the frontmatter declaring which files it routes to.
 *
 * `contextSection` arrives pre-rendered (or empty, so
 * the section vanishes) and `subject` is file-subject or cohort-subject
 * rendered — the caller composes; this template fixes the frame.
 */
interface ValidationQuestionVariables {
  /** The spec's prose, frontmatter stripped: the standard applied. */
  specBody: string;
  /** Rendered context-section, or "" when the spec declares none. */
  contextSection: string;
  /** Rendered file-subject or cohort-subject. */
  subject: string;
  /** The review input: one file's content, or an assembled cohort. */
  targetContent: string;
}

const TEMPLATE = `## SPECIFICATION

\`\`\`
{specBody}
\`\`\`

{contextSection}{subject}

\`\`\`
{targetContent}
\`\`\``;

const validationQuestion: Prompt<ValidationQuestionVariables> = preparePrompt(TEMPLATE);

export default validationQuestion;
