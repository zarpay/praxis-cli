import type { AgentMetadata } from "@/domains/spec/types.js";

/**
 * Renders the eval-targeting frontmatter lines a compiled profile carries.
 *
 * The compiled profile doubles as a spec for the eval layer; these lines
 * (`paths:`, `cohort:`, `excludes:`) are how an expert's targeting keys
 * compile through. Returns an empty array when the expert declares no
 * `validates:` targeting — the other keys are meaningless without it.
 * Shared by the pure-profile writer and every plugin so the two outputs
 * can never drift.
 */
export default function evalTargetingLines(metadata: AgentMetadata): string[] {
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
