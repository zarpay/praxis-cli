import type { Orchestrator } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import joinCritiqueLabelsService from "@/services/join-critique-labels-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { RunStore } from "@/stores/run-store.js";
import { TriageStore } from "@/stores/triage-store.js";

/** Options for `praxis axioms reassign <id> --to <axiom>`. */
interface ReassignCritiqueOptions {
  id: string;
  to: string;
}

/**
 * What `praxis axioms reassign` does: a human re-decides one critique's
 * label. Appends an assignment record to the surviving axiom — the
 * newest record wins at read time, so the prior label (a matcher's, a
 * dismissal, or an older human call) stays in the ledger beneath it.
 * Works on any critique in any state; `praxis eval critiques` is where
 * the ids come from.
 *
 * @throws PraxisError when the critique id is unknown or the axiom is
 *   not active
 */
export const reassignCritiqueOrchestrator: Orchestrator<ReassignCritiqueOptions> = async (
  ctx,
  { id, to },
) => {
  const cfg = ctx.config;

  const critiques = new RunStore(cfg).critiques();
  const critique = critiques.find((record) => record.id === id);

  if (!critique) throw errors.critiqueNotFound(id);

  const { axioms } = new AxiomStore(cfg).all();
  const axiom = axioms.find((entry) => entry.id === to && entry.status === "active");

  if (!axiom) throw errors.axiomNotFound(to);

  const [labeled] = joinCritiqueLabelsService(cfg, { critiques: [critique] });
  const before = labeled?.axiom_id ?? null;

  new TriageStore(cfg).writeSession([
    {
      kind: "assignment",
      critique_id: id,
      axiom_id: axiom.id,
      axiom_version: axiom.version,
      assigned_by: { decision: "human", suggested_by: "manual" },
      timestamp: new Date().toISOString(),
    },
  ]);

  const from = before ?? "unlabeled";
  ctx.render([
    {
      channel: "success",
      text: `${id} reassigned: ${from} → ${axiom.id}. The prior record stays in the ledger beneath this one; reports recompute from the join.`,
    },
  ]);

  return "ok";
};

export default prepareOrchestrator(reassignCritiqueOrchestrator);
