import type { AgentMetadata } from "@/types.js";

/**
 * The eval-targeting frontmatter lines a compiled profile carries.
 *
 * A fragment rather than a whole document: it is spliced into the
 * profile's frontmatter by the profile writer and by every plugin.
 *
 * The compiled profile doubles as a spec for the eval layer; these lines
 * (`paths:`, `cohort:`, `excludes:`) are how an expert's targeting keys
 * compile through. Returns an empty array when the expert declares no
 * `validates:` targeting — the other keys are meaningless without it.
 * Shared by the pure-profile writer and every plugin so the two outputs
 * can never drift.
 */
export default function evalTargetingTemplate(metadata: AgentMetadata): string[] {
  if (metadata.validates.length === 0) return [];

  const lines = ["paths:", ...metadata.validates.map((p) => `  - "${p}"`)];

  if (metadata.cohort) {
    lines.push(`cohort: ${metadata.cohort}`);
  }

  if (metadata.excludes.length > 0) {
    lines.push("excludes:", ...metadata.excludes.map((p) => `  - "${p}"`));
  }

  if (metadata.exemplars.length > 0) {
    lines.push("exemplars:", ...metadata.exemplars.map((p) => `  - "${p}"`));
  }

  return lines;
}
