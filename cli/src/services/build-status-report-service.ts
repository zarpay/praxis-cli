import type { BuildStatusReportInput, StatusReport } from "@/types.js";

import { exists } from "@/helpers/files-helper.js";
import auditExpertsService from "@/services/audit-experts-service.js";
import countDocumentsByTypeService from "@/services/count-documents-by-type-service.js";
import findOrphanedPracticesService from "@/services/find-orphaned-practices-service.js";
import listDocumentsService from "@/services/list-documents-service.js";
import tallyValidationService from "@/services/tally-validation-service.js";

/**
 * Assembles a project's health report.
 *
 * Framework health from the spec layer's documents, validation state from
 * the eval layer's cache. Both are read here rather than in the
 * orchestrator so the report can be asserted on as data.
 *
 * Framework health only applies when the spec-layer compiler is in use;
 * an eval-only project gets validation state and nothing else, because
 * it has no taxonomy to be asked about.
 */
export default async function buildStatusReport({
  root,
  config,
}: BuildStatusReportInput): Promise<StatusReport> {
  const scope = {
    root,
    specFilePattern: config.specFilePattern,
    ignore: config.ignore,
  };
  const validation = tallyValidationService({ root, config });

  if (!exists(config.expertsDir)) {
    return evalOnlyReport(validation);
  }

  const expertFiles = await listDocumentsService({
    ...scope,
    dir: config.expertsDir,
    recursive: false,
  });
  const practiceFiles = await listDocumentsService({
    ...scope,
    dir: config.practicesDir,
    recursive: false,
  });
  const counts = await countDocumentsByTypeService({ ...scope, sources: config.sources });
  const audit = await auditExpertsService({
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
    orphanedPractices: findOrphanedPracticesService({
      practiceFiles,
      referenced: audit.referencedPractices,
      root,
    }),
    danglingRefs: audit.danglingRefs,
    expertsMissingDescription: audit.missingDescriptions,
    invalidExperts: audit.invalidExperts,
    zeroMatchGlobs: audit.zeroMatchGlobs,
  };
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
  };
}
