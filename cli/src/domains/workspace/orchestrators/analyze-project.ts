import type { PraxisConfig } from "@/core/config.js";
import type { StatusReport } from "@/domains/workspace/types.js";

import { exists } from "@/core/files.js";
import auditExperts from "@/domains/workspace/services/audit-experts.js";
import countDocumentsByType from "@/domains/workspace/services/count-documents-by-type.js";
import findOrphanedPractices from "@/domains/workspace/services/find-orphaned-practices.js";
import findUnmatchedOwners from "@/domains/workspace/services/find-unmatched-owners.js";
import listDocuments from "@/domains/workspace/services/list-documents.js";
import tallyValidation from "@/domains/workspace/services/tally-validation.js";

/**
 * Assembles a project's health report.
 *
 * The one workflow that reaches into both layers: framework health from
 * the spec layer's documents, validation state from the eval layer's
 * cache. It sequences the services and scans nothing itself.
 *
 * Framework health only applies when the spec-layer compiler is in use;
 * an eval-only project gets validation state and nothing else, because
 * it has no taxonomy to be asked about.
 */
export default async function analyzeProject({
  root,
  config,
}: {
  root: string;
  config: PraxisConfig;
}): Promise<StatusReport> {
  const scope = {
    root,
    specFilePattern: config.specFilePattern,
    ignore: config.ignore,
  };
  const validation = tallyValidation({ root, config });

  if (!exists(config.expertsDir)) {
    return evalOnlyReport(validation);
  }

  const expertFiles = await listDocuments({ ...scope, dir: config.expertsDir, recursive: false });
  const practiceFiles = await listDocuments({
    ...scope,
    dir: config.practicesDir,
    recursive: false,
  });
  const counts = await countDocumentsByType({ ...scope, sources: config.sources });
  const audit = await auditExperts({
    expertFiles,
    root,
    specFilePattern: config.specFilePattern,
  });

  return {
    compilerInUse: true,
    counts: {
      experts: expertFiles.length,
      practices: practiceFiles.length,
      references: counts.references,
      context: counts.context,
    },
    validation,
    orphanedPractices: findOrphanedPractices({
      practiceFiles,
      referenced: audit.referencedPractices,
      root,
    }),
    danglingRefs: audit.danglingRefs,
    expertsMissingDescription: audit.missingDescriptions,
    invalidExperts: audit.invalidExperts,
    zeroMatchGlobs: audit.zeroMatchGlobs,
    unmatchedOwners: findUnmatchedOwners({ practiceFiles, aliases: audit.aliases }),
  };
}

/** Whether a report contains any structural issue worth a non-zero exit. */
export function hasIssues(report: StatusReport): boolean {
  return (
    report.danglingRefs.length > 0 ||
    report.orphanedPractices.length > 0 ||
    report.expertsMissingDescription.length > 0 ||
    report.zeroMatchGlobs.length > 0 ||
    report.unmatchedOwners.length > 0
  );
}

/** The report for a project with no spec layer: validation state only. */
function evalOnlyReport(validation: StatusReport["validation"]): StatusReport {
  return {
    compilerInUse: false,
    counts: { experts: 0, practices: 0, references: 0, context: 0 },
    validation,
    orphanedPractices: [],
    danglingRefs: [],
    expertsMissingDescription: [],
    invalidExperts: [],
    zeroMatchGlobs: [],
    unmatchedOwners: [],
  };
}
