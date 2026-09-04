import type {
  ChecklistAxiom,
  Critique,
  Finding,
  LedgerEntry,
  ReviewedTarget,
  Service,
  Verdict,
} from "@/types.js";

import { relativePath } from "@/helpers/paths-helper.js";
import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import reviewTargetService from "@/services/review-target-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import writeLedgerRunService from "@/services/write-ledger-run-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { SpecStore } from "@/stores/spec-store.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/** The targets to review, and the project they live in. */
interface ReviewNamedInput {
  /** Whether this run writes the ledger. Default true; CI passes false (12: verify without writing). */
  ledger?: boolean;
  /** Absolute or cwd-relative target paths. */
  targets: string[];
  /** Spec override; honored only when exactly one target was named. */
  spec?: string;
  /** Narrow to one configured reviewer by name. */
  reviewer?: string;
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /** Called once per target with its deduplicated findings (08). */
  onTarget?: (event: ReviewedTarget) => void;
}

/** What reviewing the named targets produced. */
interface ReviewNamedResult {
  /** Targets whose worst verdict was an error. */
  errors: number;
  /** Targets whose worst verdict was a warning. */
  warnings: number;
}

/**
 * Reviews the named targets, each against its own spec.
 *
 * What `praxis eval run <targets…>` does — the fast loop (08). Every
 * selected reviewer sees every target; a target's outcome is the worst
 * verdict across them, and its critiques collapse into a deduplicated
 * finding list: matched critiques merge on their axiom with witnesses
 * counted, open-channel critiques stand alone until triage.
 *
 * `spec` overrides spec discovery, and only when a single target was
 * named: pointing several targets at one spec would silently review
 * them against direction that does not govern them.
 *
 * Every fast-loop run is evidence (08): each reviewer's pass persists to
 * the ledger with `scope: "files"` unless `ledger: false`.
 *
 * @throws PraxisError when no reviewer is usable, or a target has no spec
 */
const reviewNamedService: Service<ReviewNamedInput, Promise<ReviewNamedResult>> = async (
  cfg,
  { targets, spec, reviewer: only, useCache = true, ledger = true, onTarget },
) => {
  const root = cfg.root;
  const reviewers = selectReviewersService(cfg, { only });
  const specStore = new SpecStore(cfg);
  const specOverride = targets.length === 1 ? spec : undefined;
  const entriesByReviewer = new Map<string, LedgerEntry[]>();
  const specUnits: Record<string, number> = {};

  let errors = 0;
  let warnings = 0;

  for (const targetPath of targets) {
    const subject = ReviewSubject.resolve({
      targetPath,
      specPath: specOverride ?? specStore.governingPath(targetPath),
      root,
      checklistFor: (resolvedSpec) => new AxiomStore(cfg).checklistFor(resolvedSpec),
    });

    const specKey = relativePath(root, subject.specPath);
    specUnits[specKey] = (specUnits[specKey] ?? 0) + 1;

    const verdicts: { reviewerName: string; verdict: Verdict }[] = [];

    for (const reviewerConfig of reviewers) {
      const { verdict, cacheHit, usage } = await reviewTargetService(cfg, {
        target: subject,
        reviewer: Reviewer.fromConfig(reviewerConfig),
        cache: useCache
          ? new VerdictStore(cfg, {
              reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
            })
          : null,
      });

      verdicts.push({ reviewerName: reviewerConfig.name, verdict });

      const entries = entriesByReviewer.get(reviewerConfig.name) ?? [];
      entries.push({
        verdict: { ...verdict, path: targetPath },
        cacheHit,
        evidence: {
          usage,
          specPath: subject.specPath,
          targetContentHash: subject.targetContentHash(),
          specContentHash: subject.specContentHash(),
        },
      });
      entriesByReviewer.set(reviewerConfig.name, entries);
    }

    const worst = worstVerdict(verdicts.map((entry) => entry.verdict));

    if (worst && !worst.compliant && worst.severity === "error") errors++;

    if (worst && !worst.compliant && worst.severity === "warning") warnings++;

    if (worst) {
      onTarget?.({
        path: targetPath,
        verdict: worst,
        findings: assembleFindings(verdicts, subject.checklist),
        reviewerCount: reviewers.length,
      });
    }
  }

  if (ledger) {
    for (const reviewerConfig of reviewers) {
      const entries = entriesByReviewer.get(reviewerConfig.name);

      if (!entries || entries.length === 0) continue;

      writeLedgerRunService(cfg, {
        reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
        trigger: "manual",
        scope: "files",
        entries,
        specUnits,
      });
    }
  }

  return { errors, warnings };
};

export default reviewNamedService;

/**
 * Collapses one target's critiques into findings (08, 06).
 *
 * Matched critiques dedup on their axiom id — the shared identity that
 * already exists — one finding, every flagging reviewer a witness, the
 * text and severity taken from the ratified axiom so the same violation
 * reads the same every run. Open-channel critiques have no shared
 * identity yet: each stands alone, deduped only when two reviewers
 * produce byte-identical text.
 */
function assembleFindings(
  verdicts: { reviewerName: string; verdict: Verdict }[],
  checklist: ChecklistAxiom[],
): Finding[] {
  const axiomsById = new Map(checklist.map((axiom) => [axiom.id, axiom]));
  const findings = new Map<string, Finding>();

  for (const { reviewerName, verdict } of verdicts) {
    for (const critique of verdict.issues) {
      const key = critique.axiomId ?? `open:${critique.text}`;
      const existing = findings.get(key);

      if (existing) {
        if (!existing.witnesses.includes(reviewerName)) existing.witnesses.push(reviewerName);

        continue;
      }

      findings.set(key, findingFor(critique, reviewerName, axiomsById));
    }
  }

  return [...findings.values()];
}

/** One critique's finding: the axiom's terms when matched, its own otherwise. */
function findingFor(
  critique: Critique,
  reviewerName: string,
  axiomsById: Map<string, ChecklistAxiom>,
): Finding {
  const axiom = critique.axiomId === null ? undefined : axiomsById.get(critique.axiomId);

  return {
    axiomId: critique.axiomId,
    text: axiom ? axiom.statement : critique.text,
    severity: axiom ? axiom.severity : "error",
    witnesses: [reviewerName],
  };
}

/**
 * The worst of a target's verdicts, or null when there are none.
 *
 * Reviewers are separate instruments and may disagree, so a target's
 * outcome is the most serious thing any of them said rather than a
 * consensus: any error outranks any warning, which outranks a pass.
 */
function worstVerdict(verdicts: Verdict[]): Verdict | null {
  return verdicts.reduce<Verdict | null>(
    (worst, verdict) => (!worst || severityRank(verdict) > severityRank(worst) ? verdict : worst),
    null,
  );
}

/**
 * Orders one verdict: pass < warning < error.
 *
 * A compliant verdict is lowest regardless of what severity it carries,
 * because severity only describes a failure.
 */
function severityRank(verdict: Verdict): number {
  if (verdict.compliant) return 0;

  return verdict.severity === "warning" ? 1 : 2;
}
