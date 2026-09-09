import type { PraxisConfig } from "@/models/praxis-config.js";
import type { Finding, LedgerEntry, ReviewedTarget, Service, Verdict } from "@/types.js";

import { errors as praxisErrors, PraxisError } from "@/helpers/errors-helper.js";
import { isDirectory } from "@/helpers/files-helper.js";
import { relativePath, resolvePath } from "@/helpers/paths-helper.js";
import { ReviewSubject } from "@/models/review-subject.js";
import { Reviewer } from "@/models/reviewer.js";
import discoverDomainsService from "@/services/discover-domains-service.js";
import reviewTargetService from "@/services/review-target-service.js";
import selectReviewersService from "@/services/select-reviewers-service.js";
import writeLedgerRunService from "@/services/write-ledger-run-service.js";
import { SpecStore } from "@/stores/spec-store.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/** The targets to review, and the project they live in. */
interface ReviewNamedInput {
  /** Whether this run writes the ledger. Default true; CI passes false. */
  ledger?: boolean;
  /** Absolute or cwd-relative target paths. */
  targets: string[];
  /** Spec override; honored only when exactly one target was named. */
  spec?: string;
  /** Narrow to one configured reviewer by name. */
  reviewer?: string;
  /** Whether to consult the verdict cache. */
  useCache?: boolean;
  /** Called once per target with its deduplicated findings. */
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
 * What `praxis eval run <targets…>` does — the fast loop. Every
 * selected reviewer sees every target; a target's outcome is the worst
 * verdict across them, and its critiques collapse into a deduplicated
 * finding list: matched critiques merge on their axiom with witnesses
 * counted, open-channel critiques stand alone until triage.
 *
 * `spec` overrides spec discovery, and only when a single target was
 * named: pointing several targets at one spec would silently review
 * them against direction that does not govern them.
 *
 * Every fast-loop run is evidence: each reviewer's pass persists to
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
    if (isDirectory(targetPath)) throw praxisErrors.targetIsDirectory(targetPath);

    const subject = ReviewSubject.resolve({
      targetPath,
      specPath: specOverride ?? governingSpecFor(cfg, specStore, targetPath),
      root,
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
        findings: assembleFindings(verdicts),
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
 * The deduplicated finding list a caller works through (vocabulary):
 * every critique is born raw, so identity is the critique's exact text —
 * two reviewers writing the same sentence corroborate one finding, and
 * near-duplicates stay separate until triage labels them under one
 * axiom.
 */
function assembleFindings(verdicts: { reviewerName: string; verdict: Verdict }[]): Finding[] {
  const byText = new Map<string, Finding>();

  for (const { reviewerName, verdict } of verdicts) {
    for (const critique of verdict.issues) {
      const held = byText.get(critique.text);

      if (held) {
        if (!held.witnesses.includes(reviewerName)) held.witnesses.push(reviewerName);

        continue;
      }

      byText.set(critique.text, {
        axiomId: null,
        text: critique.text,
        severity: verdict.severity ?? "error",
        witnesses: [reviewerName],
      });
    }
  }

  return [...byText.values()];
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

/**
 * The spec governing a named target, resolved exactly like a full run:
 * the sibling pattern first, then the paths-targeted domains — a
 * compiled expert governs from afar, and the fast loop must see it
 * (found live in servus, 2026-09-06).
 *
 * @throws the sibling lookup's instructive error when neither names it
 */
function governingSpecFor(cfg: PraxisConfig, specStore: SpecStore, targetPath: string): string {
  try {
    return specStore.governingPath(targetPath);
  } catch (err) {
    if (!(err instanceof PraxisError) || err.code !== "SPEC_NOT_FOUND") throw err;

    const absolute = resolvePath(targetPath);
    const domains = discoverDomainsService(cfg, {});
    const owner = domains.find((domain) => {
      const files = domain.targetFiles ?? [];
      const dirs = domain.targetDirs ?? [];

      return files.includes(absolute) || dirs.some((dir) => absolute.startsWith(`${dir}/`));
    });

    if (owner) return owner.specPath;

    throw err;
  }
}
