import type { StatusReport } from "@/domains/workspace/types.js";
import type { BadgeEntry } from "@/types.js";

import { verdictTally } from "@/views/badges.js";
import { statLines } from "@/views/stats.js";

/** The document-count lines, label-aligned. */
export function countLines(counts: StatusReport["counts"]): string[] {
  return statLines([
    ["Experts", counts.experts],
    ["Practices", counts.practices],
    ["References", counts.references],
    ["Context files", counts.context],
  ]);
}

/**
 * One badge block per judge that has judged anything.
 *
 * A judge with no verdicts at all is dropped rather than rendered as
 * four zeros, which reads as a broken judge instead of an unused one.
 *
 * A project with no judges configured still has a row — its targets are
 * all unvalidated, which is worth saying — so the nameless reader gets
 * a label rather than rendering as "null".
 */
export function validationBlocks(
  validation: StatusReport["validation"],
): { judge: string; badges: BadgeEntry[] }[] {
  return validation
    .filter((v) => v.pass + v.warn + v.fail + v.notValidated > 0)
    .map((v) => ({ judge: v.judge ?? "none configured", badges: verdictTally(v) }));
}

/**
 * The framework-health findings a report carries, in display order.
 *
 * Blocks with nothing to report are dropped, so the caller renders
 * every block it is given and the count of findings is the sum of their
 * items.
 */
export function issueBlocks(report: StatusReport): { heading: string; items: string[] }[] {
  const blocks = [
    {
      heading: "Dangling references (file not found):",
      items: report.danglingRefs.map(({ expert, ref }) => `${expert} → ${ref}`),
    },
    {
      heading: "Orphaned practices (not referenced by any expert):",
      items: report.orphanedPractices,
    },
    { heading: "Experts missing description:", items: report.expertsMissingDescription },
    {
      heading: "Experts that failed to parse:",
      items: report.invalidExperts.map(({ expert, reason }) => `${expert}: ${reason}`),
    },
    {
      heading: "Glob patterns matching zero files:",
      items: report.zeroMatchGlobs.map(({ expert, pattern }) => `${expert}: ${pattern}`),
    },
    {
      heading: "Practices with unknown owners:",
      items: report.unmatchedOwners.map(({ practice, owner }) => `${practice} (owner: ${owner})`),
    },
  ];

  return blocks.filter((block) => block.items.length > 0);
}
