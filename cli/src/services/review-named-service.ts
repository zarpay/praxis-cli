import type {
  ChecklistAxiom,
  Critique,
  Finding,
  LedgerEntry,
  ReviewNamedInput,
  ReviewNamedResult,
  Verdict,
} from "@/types.js";

import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import { VerdictCache } from "@/models/verdict-cache.js";
import resolveChecklistService from "@/services/resolve-checklist-service.js";
import reviewTargetService from "@/services/review-target-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import writeLedgerRunService from "@/services/write-ledger-run-service.js";

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
export default async function reviewNamed({
  targets,
  root,
  config,
  spec,
  reviewer: only,
  useCache = true,
  ledger = true,
  onTarget,
}: ReviewNamedInput): Promise<ReviewNamedResult> {
  const reviewers = selectReviewersService({ configured: config.reviewers, only });
  const specPath = targets.length === 1 ? spec : undefined;
  const entriesByReviewer = new Map<string, LedgerEntry[]>();

  let errors = 0;
  let warnings = 0;

  for (const targetPath of targets) {
    const subject = ReviewSubject.resolve({
      targetPath,
      specPath,
      specFilePattern: config.specFilePattern,
      root,
      checklistFor: (resolvedSpec) => resolveChecklistService({ root, specPath: resolvedSpec }),
    });

    const verdicts: { reviewerName: string; verdict: Verdict }[] = [];

    for (const reviewerConfig of reviewers) {
      const { verdict, cacheHit, usage } = await reviewTargetService({
        target: subject,
        reviewer: Reviewer.fromConfig(reviewerConfig),
        cache: useCache
          ? new VerdictCache({
              projectRoot: root,
              reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
            })
          : null,
        root,
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

      writeLedgerRunService({
        root,
        reviewer: Reviewer.fromConfig(reviewerConfig).cacheIdentity(),
        trigger: "manual",
        scope: "files",
        entries,
      });
    }
  }

  return { errors, warnings };
}

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
