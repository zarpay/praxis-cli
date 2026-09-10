import type { AxiomFile } from "@/models/axiom-file.js";
import type { LedgerCritiqueRecord, Orchestrator, TriageRecord } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import joinCritiqueLabelsService from "@/services/join-critique-labels-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";
import mergeReportView from "@/views/merge-report-view.js";

/** Options for `praxis axioms merge <ids...> --into <id>`. */
interface MergeAxiomsOptions {
  ids: string[];
  into: string;
}

/**
 * What `praxis axioms merge` does: collapses over-split axioms
 * into one, with nothing rewritten and everything derived.
 *
 * The append-only join is the whole mechanism: every critique whose
 * effective label is a merged-away axiom gets a new assignment record
 * to the survivor (decision "merge" — the prior label stays beneath it
 * in the ledger), the losers are deprecated with the merge named as the
 * reason, and the survivor inherits the earliest `introduced` date
 * among the merged so folded-in critiques are not misread as pre-spec
 * debt. Reports recompute instantly: the survivor's series now carries
 * all merged evidence retroactively; the deprecated ids keep their
 * history readable and stop accruing.
 *
 * A merged-away axiom may already be deprecated: a deprecation that
 * predates the merge command left its evidence stranded under the
 * retired id, and folding that history is exactly this command's job —
 * only the survivor must be active.
 *
 * @throws PraxisError when the survivor is not an active axiom, any
 *   source id names no axiom, or the merge has no sources
 */
export const mergeAxiomsOrchestrator: Orchestrator<MergeAxiomsOptions> = async (
  ctx,
  { ids, into },
) => {
  const cfg = ctx.config;
  const store = new AxiomStore(cfg);
  const { axioms } = store.all();

  const survivor = activeOrThrow(axioms, into);
  const loserIds = [...new Set(ids.filter((id) => id !== into))];

  if (loserIds.length === 0) throw errors.mergeNeedsSources(into);

  const losers = loserIds.map((id) => existingOrThrow(axioms, id));

  const critiques = new RunStore(cfg).critiques();
  const labeled = joinCritiqueLabelsService(cfg, { critiques });
  const moving = labeled.filter(
    (critique) => critique.axiom_id !== null && loserIds.includes(critique.axiom_id),
  );

  const records: TriageRecord[] = [
    ...moving.map((critique) => reassignment(critique, survivor)),
    ...losers.map((loser) => deprecation(loser.id, survivor.id)),
  ];

  const introduced = earliestIntroduced([survivor, ...losers]);

  if (introduced !== survivor.introduced) {
    store.amendIntroduced(survivor.id, introduced);
  }

  for (const loser of losers) {
    if (loser.status !== "deprecated") store.deprecate(loser.id);
  }

  new TriageStore(cfg).writeSession(records);

  const movedByLoser = new Map<string, number>(loserIds.map((id) => [id, 0]));

  for (const critique of moving) {
    const id = critique.axiom_id ?? "";
    movedByLoser.set(id, (movedByLoser.get(id) ?? 0) + 1);
  }

  const view = mergeReportView({
    survivorId: survivor.id,
    survivorStatement: survivor.statement(),
    moved: [...movedByLoser.entries()].map(([axiomId, count]) => ({ axiomId, count })),
    introduced,
    introducedChanged: introduced !== survivor.introduced,
  });
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(mergeAxiomsOrchestrator);

/** The axiom, provided it exists and is active — the survivor's bar. */
function activeOrThrow(axioms: AxiomFile[], id: string): AxiomFile {
  const axiom = existingOrThrow(axioms, id);

  if (axiom.status !== "active") throw errors.mergeSurvivorNotActive(id);

  return axiom;
}

/** The axiom, provided it exists — deprecated sources still fold. */
function existingOrThrow(axioms: AxiomFile[], id: string): AxiomFile {
  const axiom = axioms.find((candidate) => candidate.id === id);

  if (!axiom) throw errors.axiomNotFound(id);

  return axiom;
}

/** One critique's label moved to the survivor — the prior label stays beneath. */
function reassignment(critique: LedgerCritiqueRecord, survivor: AxiomFile): TriageRecord {
  return {
    kind: "assignment",
    critique_id: critique.id,
    axiom_id: survivor.id,
    axiom_version: survivor.version,
    assigned_by: { decision: "merge", suggested_by: "axioms-merge" },
    timestamp: new Date().toISOString(),
  };
}

/** One merged-away axiom's retirement record. */
function deprecation(axiomId: string, survivorId: string): TriageRecord {
  return {
    kind: "deprecation",
    axiom_id: axiomId,
    reason: `merged into ${survivorId}`,
    timestamp: new Date().toISOString(),
  };
}

/** The earliest population clock among the merged axioms. */
function earliestIntroduced(axioms: AxiomFile[]): string {
  return axioms.map((axiom) => axiom.introduced).sort()[0] ?? "";
}
