import type { PraxisConfig } from "@/models/praxis-config.js";
import type { NoInput, Service, StatusReport } from "@/types.js";

import { exists } from "@/helpers/files-helper.js";
import auditExpertsService from "@/services/audit-experts-service.js";
import buildCritiquesReportService from "@/services/build-critiques-report-service.js";
import deriveTriageStateService from "@/services/derive-triage-state-service.js";
import detectEpochBoundariesService from "@/services/detect-epoch-boundaries-service.js";
import measureEvalCoverageService from "@/services/measure-eval-coverage-service.js";
import tallyValidationService from "@/services/tally-validation-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { DocumentStore } from "@/stores/document-store.js";
import { ExpertStore } from "@/stores/expert-store.js";
import { PracticeStore } from "@/stores/practice-store.js";
import { RunStore } from "@/stores/run-store.js";

/**
 * Assembles a project's health report.
 *
 * Framework health from the spec layer's documents, validation state from
 * the eval layer's cache. Both are read here rather than in the
 * orchestrator so the report can be asserted on as data — `issueCount`
 * included, which is what `praxis status` maps to its exit code: any
 * finding at all fails CI on a project whose taxonomy has drifted, and
 * an expert that failed to parse counts, because a document the compiler
 * cannot read is as structural as one pointing at a file that isn't
 * there.
 *
 * Framework health only applies when the spec-layer compiler is in use;
 * an eval-only project gets validation state and nothing else, because
 * it has no taxonomy to be asked about.
 */
const buildStatusReportService: Service<NoInput, Promise<StatusReport>> = async (cfg) => {
  const validation = tallyValidationService(cfg, {});
  const evalState = evalStateOf(cfg);
  const coverage = measureEvalCoverageService(cfg, {});
  const feedback = feedbackOf(cfg);
  const activeAxioms = activeAxiomCount(cfg);

  if (!exists(cfg.expertsDir)) {
    return evalOnlyReport({ validation, evalState, coverage, feedback, activeAxioms });
  }

  const expertStore = new ExpertStore(cfg);
  const practiceStore = new PracticeStore(cfg);
  const documentStore = new DocumentStore(cfg);

  const expertFiles = expertStore.files();
  const counts = documentStore.countsByType();
  const audit = await auditExpertsService(cfg, { expertFiles });

  const findings = {
    orphanedPractices: practiceStore.orphans(audit.referencedPractices),
    danglingRefs: audit.danglingRefs,
    expertsMissingDescription: audit.missingDescriptions,
    invalidExperts: audit.invalidExperts,
    zeroMatchGlobs: audit.zeroMatchGlobs,
  };

  return {
    compilerInUse: true,
    counts: {
      experts: expertFiles.length,
      practices: practiceStore.files().length,
      references: counts.references,
      context: counts.context,
      axioms: activeAxioms,
    },
    validation,
    evalState,
    coverage,
    feedback,
    issueCount: issueCountOf(findings),
    ...findings,
  };
};

export default buildStatusReportService;

/** How many structural problems the report found — the exit-code fact. */
function issueCountOf(findings: {
  orphanedPractices: string[];
  danglingRefs: StatusReport["danglingRefs"];
  expertsMissingDescription: string[];
  invalidExperts: StatusReport["invalidExperts"];
  zeroMatchGlobs: StatusReport["zeroMatchGlobs"];
}): number {
  return (
    findings.danglingRefs.length +
    findings.orphanedPractices.length +
    findings.expertsMissingDescription.length +
    findings.invalidExperts.length +
    findings.zeroMatchGlobs.length
  );
}

/** The eval-layer facts every report carries, spec layer or not. */
interface EvalFacts {
  validation: StatusReport["validation"];
  evalState: StatusReport["evalState"];
  coverage: StatusReport["coverage"];
  feedback: StatusReport["feedback"];
  activeAxioms: number;
}

/** The report for a project with no spec layer: eval-layer state only. */
function evalOnlyReport({
  validation,
  evalState,
  coverage,
  feedback,
  activeAxioms,
}: EvalFacts): StatusReport {
  return {
    compilerInUse: false,
    counts: { experts: 0, practices: 0, references: 0, context: 0, axioms: activeAxioms },
    validation,
    evalState,
    coverage,
    feedback,
    issueCount: 0,
    orphanedPractices: [],
    danglingRefs: [],
    expertsMissingDescription: [],
    invalidExperts: [],
    zeroMatchGlobs: [],
  };
}

/** The critique lifecycle totals, from the same derivation `eval critiques` reports. */
function feedbackOf(cfg: PraxisConfig): StatusReport["feedback"] {
  const { totals } = buildCritiquesReportService(cfg, {});
  const critiques =
    totals.untriaged + totals.unmatched + totals.labeled + totals.dismissed + totals.advisory;

  return {
    critiques,
    labeled: totals.labeled,
    untriaged: totals.untriaged,
    awaitingCuration: totals.unmatched,
    dismissed: totals.dismissed,
    advisory: totals.advisory,
  };
}

/** How many axioms are currently active. */
function activeAxiomCount(cfg: PraxisConfig): number {
  const { axioms } = new AxiomStore(cfg).all();

  return axioms.filter((axiom) => axiom.status === "active").length;
}

/** The situational-poll facts, derived from the stores. */
function evalStateOf(cfg: PraxisConfig): StatusReport["evalState"] {
  const state = deriveTriageStateService(cfg, {});
  const runs = new RunStore(cfg).runs();
  const boundaries = detectEpochBoundariesService(cfg, { reviewers: cfg.reviewers });

  const lastRun = runs.map((run) => run.timestamp).sort()[runs.length - 1] ?? null;

  return {
    pending_triage: state.pending.length,
    awaiting_curation: state.unidentified.length,
    calibration_stale: true,
    epoch_boundary_detected: boundaries.length > 0,
    last_run_at: lastRun,
  };
}
