import type { StatusReport } from "@/types.js";

/**
 * How many structural problems a health report found.
 *
 * What `praxis status` maps to its exit code: any finding at all means a
 * non-zero exit, so CI fails on a project whose taxonomy has drifted.
 *
 * An expert that failed to parse counts. It is reported in the output like
 * every other finding, and a document the compiler cannot read is as
 * structural as one that points at a file that isn't there.
 */
export default function countStatusIssues(report: StatusReport): number {
  return (
    report.danglingRefs.length +
    report.orphanedPractices.length +
    report.expertsMissingDescription.length +
    report.invalidExperts.length +
    report.zeroMatchGlobs.length
  );
}
