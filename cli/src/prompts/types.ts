/**
 * The types the prompt templates take, grouped here so every other file
 * in this directory is exactly one prompt: a default-export function.
 */

/**
 * A file inlined into a prompt: its display path and content.
 *
 * Structurally compatible with the eval layer's resolved AssistFile —
 * declared separately so prompts stay a leaf directory (imports core
 * only) that both layers can use without depending on each other.
 */
export interface PromptFile {
  path: string;
  content: string;
}

/** Everything the judge's user prompt is built from. */
export interface ValidationQuestionInput {
  /** The spec content the target is judged against. */
  specContent: string;
  /** The judgment input: one file's content, or an assembled cohort. */
  targetContent: string;
  /** Path of the file, or of the cohort's directory. */
  targetPath: string;
  /** Whether the target is one file or a pre-assembled cohort of files. */
  kind: "file" | "cohort";
  /** Spec-blessed positive examples, inlined and never judged. */
  exemplars: readonly PromptFile[];
  /** Assist-only reference files, inlined and never judged. */
  context: readonly PromptFile[];
}
