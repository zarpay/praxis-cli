import type {
  DebtReport,
  DebtRow,
  Epoch,
  LedgerCritiqueRecord,
  NoInput,
  PaydownCredit,
  Service,
} from "@/types.js";

import { authorsOfRange } from "@/helpers/git-helper.js";
import deriveEpochsService from "@/services/derive-epochs-service.js";
import joinCritiqueLabelsService from "@/services/join-critique-labels-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";

/**
 * The debt report: baseline stock, current stock, and
 * corpus-level paydown per axiom — the honest surface for P1, never
 * charted as agent performance.
 *
 * Paydown is within-epoch set-difference between each reviewer's
 * epoch-opening baseline run and its latest corpus run: a violation in
 * the baseline that is gone at latest was paid down; one absent at
 * baseline and present now "appeared since baseline". Both runs share
 * the reviewer hash by construction, so sampling drift cannot
 * masquerade as flow across a behavior change. Credit goes to the git
 * authors who touched a resolved file between the two anchored shas
 *.
 */
const buildDebtReportService: Service<NoInput, DebtReport> = (cfg) => {
  const runStore = new RunStore(cfg);
  const allCritiques = joinCritiqueLabelsService(cfg, { critiques: runStore.critiques() });
  const { axioms } = new AxiomStore(cfg).all();
  const statements = new Map(axioms.map((axiom) => [axiom.id, axiom.statement()]));

  const rows: DebtRow[] = [];
  const evidence: DebtReport["evidence"] = [];
  const credits: PaydownCredit[] = [];
  const concentration = new Map<string, number>();
  let creditNote: string | null = null;
  let rebaseline: DebtReport["rebaseline"] = null;

  for (const reviewer of deriveEpochsService(cfg, { runs: runStore.runs() })) {
    const epoch = reviewer.epochs[reviewer.epochs.length - 1];
    const latest = latestEvidencedCorpusRun(epoch);

    if (epoch.baseline === null || latest === null) continue;

    evidence.push({
      reviewerName: reviewer.reviewerName,
      baselineAt: epoch.baseline.timestamp,
      currentAt: latest.timestamp,
    });

    const baselineViolations = violationsOfRun(allCritiques, epoch.baseline.run_id);
    const latestViolations = violationsOfRun(allCritiques, latest.run_id);
    const paid = notIn(baselineViolations, latestViolations);
    const appeared = notIn(latestViolations, baselineViolations);

    rows.push(
      ...debtRows(
        reviewer.reviewerName,
        { baselineViolations, latestViolations, paid, appeared },
        statements,
      ),
    );

    if (paid.length > 0 && (epoch.baseline.commit_sha === null || latest.commit_sha === null)) {
      creditNote =
        "paydown credit unavailable: the baseline or latest run was not anchored to a commit";
    } else {
      credits.push(...paydownCredits(cfg.root, paid, epoch.baseline.commit_sha, latest.commit_sha));
    }

    tallyConcentration(latestViolations, concentration);

    rebaseline ??= rebaselineDelta(reviewer.epochs, allCritiques);
  }

  return {
    evidence,
    rows: rows.sort((a, b) => a.axiomId.localeCompare(b.axiomId)),
    concentration: [...concentration.entries()]
      .map(([directory, violations]) => ({ directory, violations }))
      .sort((a, b) => b.violations - a.violations),
    credits: mergeCredits(credits),
    creditNote,
    rebaseline,
  };
};

export default buildDebtReportService;

/**
 * One run's violations: its matched critiques, deduplicated to one per
 * (axiom, file) — two critiques of one axiom in one file are one
 * violation (vocabulary: a finding, when counted).
 */
function violationsOfRun(critiques: LedgerCritiqueRecord[], runId: string): LedgerCritiqueRecord[] {
  const ofRun = critiques.filter(
    (critique) => critique.run_id === runId && critique.axiom_id !== null,
  );

  const seen = new Set<string>();
  const violations: LedgerCritiqueRecord[] = [];

  for (const critique of ofRun) {
    const key = violationKey(critique);

    if (seen.has(key)) continue;

    seen.add(key);
    violations.push(critique);
  }

  return violations;
}

/** The identity a violation is compared on. Never parsed back — records stay records. */
function violationKey(critique: LedgerCritiqueRecord): string {
  return `${critique.axiom_id}\x00${critique.file_path}`;
}

/** The violations of `these` that `others` does not contain. */
function notIn(
  these: LedgerCritiqueRecord[],
  others: LedgerCritiqueRecord[],
): LedgerCritiqueRecord[] {
  const otherKeys = new Set(others.map(violationKey));

  return these.filter((violation) => !otherKeys.has(violationKey(violation)));
}

/** One reviewer's per-axiom rows from the four violation lists. */
function debtRows(
  reviewerName: string,
  lists: {
    baselineViolations: LedgerCritiqueRecord[];
    latestViolations: LedgerCritiqueRecord[];
    paid: LedgerCritiqueRecord[];
    appeared: LedgerCritiqueRecord[];
  },
  statements: Map<string, string>,
): DebtRow[] {
  const axiomIds = new Set(
    [...lists.baselineViolations, ...lists.latestViolations].map((v) => v.axiom_id!),
  );

  const countFor = (violations: LedgerCritiqueRecord[], axiomId: string) =>
    violations.filter((violation) => violation.axiom_id === axiomId).length;

  return [...axiomIds].map((axiomId) => ({
    axiomId,
    statement: statements.get(axiomId) ?? "(axiom no longer in store)",
    reviewerName,
    baselineStock: countFor(lists.baselineViolations, axiomId),
    currentStock: countFor(lists.latestViolations, axiomId),
    paydown: countFor(lists.paid, axiomId),
    appearedSinceBaseline: countFor(lists.appeared, axiomId),
  }));
}

/** Credit per author for the resolved files, from the anchored range. */
function paydownCredits(
  root: string,
  paid: LedgerCritiqueRecord[],
  fromSha: string | null,
  toSha: string | null,
): PaydownCredit[] {
  if (fromSha === null || toSha === null) return [];

  const credits: PaydownCredit[] = [];

  for (const violation of paid) {
    for (const author of authorsOfRange(root, fromSha, toSha, violation.file_path)) {
      credits.push({ author, resolved: 1 });
    }
  }

  return credits;
}

/** Sums per-author entries into one row per author, most credited first. */
function mergeCredits(credits: PaydownCredit[]): PaydownCredit[] {
  const byAuthor = new Map<string, number>();

  for (const credit of credits) {
    byAuthor.set(credit.author, (byAuthor.get(credit.author) ?? 0) + credit.resolved);
  }

  return [...byAuthor.entries()]
    .map(([author, resolved]) => ({ author, resolved }))
    .sort((a, b) => b.resolved - a.resolved);
}

/** Adds one run's violations into the per-directory tally. */
function tallyConcentration(
  violations: LedgerCritiqueRecord[],
  concentration: Map<string, number>,
): void {
  for (const violation of violations) {
    const path = violation.file_path;
    const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ".";

    concentration.set(directory, (concentration.get(directory) ?? 0) + 1);
  }
}

/** Stock movement across the last two baselines, boundary named. */
function rebaselineDelta(
  epochs: Epoch[],
  critiques: LedgerCritiqueRecord[],
): DebtReport["rebaseline"] {
  if (epochs.length < 2) return null;

  const previous = epochs[epochs.length - 2];
  const current = epochs[epochs.length - 1];

  if (previous.baseline === null || current.baseline === null) return null;

  return {
    boundaryLabel: current.openedBy?.label ?? "epoch change",
    before: violationsOfRun(critiques, previous.baseline.run_id).length,
    after: violationsOfRun(critiques, current.baseline.run_id).length,
  };
}

/**
 * The newest *evidenced* corpus run of an epoch, or null when it has
 * none. An all-hit run restates no critiques, so it carries no stock evidence and never moves the anchor —
 * the report says when the stock was last evidenced instead.
 */
function latestEvidencedCorpusRun(epoch: Epoch) {
  const evidenced = epoch.runs.filter((run) => run.scope === "corpus" && run.cache_misses !== 0);

  if (evidenced.length === 0) return null;

  return evidenced[evidenced.length - 1];
}
