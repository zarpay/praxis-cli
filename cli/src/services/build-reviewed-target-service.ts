import type { Finding, ReviewedTarget, Service, Verdict } from "@/types.js";

/** One target's verdicts, and the path to show them under. */
interface BuildReviewedTargetInput {
  /** The path as the reader should see it. */
  path: string;
  /** One entry per reviewer that looked. */
  verdicts: { reviewerName: string; verdict: Verdict }[];
}

/**
 * What a human sees for one target: the worst verdict any reviewer
 * returned, and the findings deduplicated across all of them.
 *
 * Reviewers are separate instruments and may disagree, so a target's
 * outcome is the most serious thing any of them said rather than a
 * consensus: any error outranks any warning, which outranks a pass. The
 * findings fold by their text, counting which reviewers said each —
 * corroboration is the signal, and repeating the same sentence once per
 * reviewer buries it.
 *
 * Returns null when nothing looked at the target.
 */
const buildReviewedTargetService: Service<BuildReviewedTargetInput, ReviewedTarget | null> = (
  _cfg,
  { path, verdicts },
) => {
  const worst = worstVerdict(verdicts.map((entry) => entry.verdict));

  if (!worst) return null;

  return {
    path,
    verdict: worst,
    findings: assembleFindings(verdicts),
    reviewerCount: verdicts.length,
  };
};

export default buildReviewedTargetService;

/** The worst of a target's verdicts, or null when there are none. */
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

/** Findings folded by text, each carrying the reviewers that raised it. */
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
