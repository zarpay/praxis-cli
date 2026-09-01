import type { StatusReport } from "@/domains/workspace/types.js";
import type { PraxisProjectBaseOptions } from "@/types.js";

import { PraxisProjectBase } from "@/core/base.js";
import { exists } from "@/core/files.js";
import { ExpertAuditor } from "@/domains/workspace/services/audit-experts.js";
import { DocumentDiscovery } from "@/domains/workspace/services/discover-documents.js";
import { tallyValidation } from "@/domains/workspace/services/tally-validation.js";

/**
 * Assembles a project's health report.
 *
 * The one place that reaches into both layers: framework health comes
 * from the spec layer's documents, validation state from the eval
 * layer's cache. It coordinates the three services and does no scanning
 * of its own.
 */
export class ProjectStatus extends PraxisProjectBase {
  private readonly documents: DocumentDiscovery;
  private readonly auditor: ExpertAuditor;

  constructor(options: PraxisProjectBaseOptions) {
    super(options);
    const specFilePattern = this.config.specFilePattern;

    this.documents = new DocumentDiscovery({
      root: this.root,
      specFilePattern,
      ignore: this.config.ignore,
    });
    this.auditor = new ExpertAuditor({ root: this.root, specFilePattern });
  }

  /** Whether a report contains any structural issue worth a non-zero exit. */
  static hasIssues(report: StatusReport): boolean {
    return (
      report.danglingRefs.length > 0 ||
      report.orphanedPractices.length > 0 ||
      report.expertsMissingDescription.length > 0 ||
      report.zeroMatchGlobs.length > 0 ||
      report.unmatchedOwners.length > 0
    );
  }

  /** Analyzes the project and returns a structured health report. */
  async analyze(): Promise<StatusReport> {
    // Framework health only applies when the spec-layer compiler is in
    // use; eval-only projects get validation state and nothing else.
    if (!exists(this.config.expertsDir)) {
      return this.evalOnlyReport();
    }

    const expertFiles = await this.documents.list(this.config.expertsDir, false);
    const practiceFiles = await this.documents.list(this.config.practicesDir, false);
    const typeCounts = await this.documents.countByType(this.config.sources);
    const audit = await this.auditor.audit(expertFiles);

    return {
      compilerInUse: true,
      counts: {
        experts: expertFiles.length,
        practices: practiceFiles.length,
        references: typeCounts.references,
        context: typeCounts.context,
      },
      validation: tallyValidation(this.root, this.config),
      orphanedPractices: this.auditor.findOrphanedPractices(
        practiceFiles,
        audit.referencedPractices,
      ),
      danglingRefs: audit.danglingRefs,
      expertsMissingDescription: audit.missingDescriptions,
      invalidExperts: audit.invalidExperts,
      zeroMatchGlobs: audit.zeroMatchGlobs,
      unmatchedOwners: this.auditor.findUnmatchedOwners(practiceFiles, audit.aliases),
    };
  }

  /** The report for a project with no spec layer: validation state only. */
  private evalOnlyReport(): StatusReport {
    return {
      compilerInUse: false,
      counts: { experts: 0, practices: 0, references: 0, context: 0 },
      validation: tallyValidation(this.root, this.config),
      orphanedPractices: [],
      danglingRefs: [],
      expertsMissingDescription: [],
      invalidExperts: [],
      zeroMatchGlobs: [],
      unmatchedOwners: [],
    };
  }
}
