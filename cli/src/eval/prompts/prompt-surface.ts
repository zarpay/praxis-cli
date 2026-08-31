import type { AssistFile } from "@/eval/judgment-input.js";

import judgeTools from "@/eval/prompts/judge-tools.js";
import systemPrompt from "@/eval/prompts/system-prompt.js";
import validationQuestion from "@/eval/prompts/validation-question.js";

/** Sentinel assist file so the section templates render deterministically. */
const SENTINEL_FILE: AssistFile = { path: "«path»", content: "«content»" };

/** Sentinel inputs for the question template, one per variant. */
const SENTINEL_INPUT = {
  specContent: "«spec»",
  targetContent: "«target»",
  targetPath: "«dir»/«file»",
  exemplars: [SENTINEL_FILE],
  context: [SENTINEL_FILE],
} as const;

/**
 * The judge's complete prompt surface as one deterministic string:
 * system prompt, tool definitions, and every question template rendered
 * with sentinel inputs (both subject variants, both assist sections).
 *
 * This is the prompt component of the judge hash (judge-hash.ts).
 * Rewording ANY judge-facing prompt text — a tool description as much
 * as the system prompt — changes the judge's behavior, so it must
 * change the judge's identity (05): no version constant to forget
 * bumping, no prompt edit that silently serves stale verdicts.
 */
export default function promptSurface(): string {
  return [
    systemPrompt(),
    JSON.stringify(judgeTools()),
    validationQuestion({ ...SENTINEL_INPUT, kind: "file" }),
    validationQuestion({ ...SENTINEL_INPUT, kind: "cohort" }),
  ].join("\n«»\n");
}
