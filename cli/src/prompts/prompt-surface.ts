import type { AssistFile, ChecklistAxiom } from "@/types.js";

import reviewTools from "@/prompts/review-tools.js";
import systemPrompt from "@/prompts/system-prompt.js";
import validationQuestion from "@/prompts/validation-question.js";

/** Sentinel assist file so the section templates render deterministically. */
const SENTINEL_FILE: AssistFile = { path: "«path»", content: "«content»" };

/** Sentinel checklist entry so the axiom section renders deterministically. */
const SENTINEL_AXIOM: ChecklistAxiom = {
  id: "AX-«id»",
  version: 1,
  severity: "error",
  statement: "«statement»",
  body: "«axiom»",
};

/** Sentinel inputs for the question template, one per variant. */
const SENTINEL_INPUT = {
  specContent: "«spec»",
  targetContent: "«target»",
  targetPath: "«dir»/«file»",
  checklist: [SENTINEL_AXIOM],
  exemplars: [SENTINEL_FILE],
  context: [SENTINEL_FILE],
} as const;

/**
 * The reviewer's complete prompt surface as one deterministic string:
 * system prompt, tool definitions, and every question template rendered
 * with sentinel inputs (both subject variants, both assist sections).
 *
 * This is the prompt component of the reviewer hash (hash-reviewer.ts).
 * Rewording ANY reviewer-facing prompt text — a tool description as much
 * as the system prompt — changes the reviewer's behavior, so it must
 * change the reviewer's identity (05): no version constant to forget
 * bumping, no prompt edit that silently serves stale verdicts.
 */
export default function promptSurface(): string {
  return [
    systemPrompt(),
    JSON.stringify(reviewTools()),
    validationQuestion({ ...SENTINEL_INPUT, kind: "file" }),
    validationQuestion({ ...SENTINEL_INPUT, kind: "cohort" }),
  ].join("\n«»\n");
}
