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
