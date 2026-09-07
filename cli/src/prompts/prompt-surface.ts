import cohortSubject from "@/prompts/cohort-subject.js";
import contextBlock from "@/prompts/context-block.js";
import contextSection from "@/prompts/context-section.js";
import exemplarBlock from "@/prompts/exemplar-block.js";
import exemplarSection from "@/prompts/exemplar-section.js";
import fileSubject from "@/prompts/file-subject.js";
import reviewTools from "@/prompts/review-tools.js";
import systemPrompt from "@/prompts/system-prompt.js";
import validationQuestion from "@/prompts/validation-question.js";

/** Sentinel assist file so the section templates render deterministically. */
const SENTINEL_FILE = { path: "«path»", content: "«content»" };

/**
 * The reviewer's complete prompt surface as one deterministic string:
 * system prompt, tool definitions, and the validation question rendered
 * with sentinel inputs (both subject variants, both assist sections).
 *
 * This is the prompt component of the reviewer hash (reviewer.ts).
 * Rewording ANY reviewer-facing prompt text — a tool description as much
 * as the system prompt — changes the reviewer's behavior, so it must
 * change the reviewer's identity: no version constant to forget
 * bumping, no prompt edit that silently serves stale verdicts.
 */
export default function promptSurface(): string {
  const exemplarBlocks = exemplarBlock(SENTINEL_FILE);
  const contextBlocks = contextBlock(SENTINEL_FILE);
  const sections = {
    specContent: "«spec»",
    exemplarSection: exemplarSection({ blocks: exemplarBlocks }),
    contextSection: contextSection({ blocks: contextBlocks }),
    targetContent: "«target»",
  };
  const fileVariant = validationQuestion({
    ...sections,
    subject: fileSubject({ fileName: "«file»", directory: "«dir»" }),
  });
  const cohortVariant = validationQuestion({
    ...sections,
    subject: cohortSubject({ targetPath: "«dir»/«file»" }),
  });

  return [systemPrompt(), JSON.stringify(reviewTools()), fileVariant, cohortVariant].join("\n«»\n");
}
