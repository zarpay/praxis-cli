import type { Orchestrator } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import { TriageStore } from "@/stores/triage-store.js";

/** Options for `praxis axioms deprecate <id>`. */
interface DeprecateAxiomOptions {
  id: string;
  reason: string;
}

/**
 * What `praxis axioms deprecate <id>` does: retires an active axiom.
 * The file flips to `status: deprecated` (id and records stay
 * readable forever), a deprecation record lands in the triage ledger
 * with the reason, and — because the active set changed — every
 * unidentified critique re-queues for triage automatically.
 *
 * @throws PraxisError when the id names no active axiom
 */
export const deprecateAxiomOrchestrator: Orchestrator<DeprecateAxiomOptions> = async (
  ctx,
  { id, reason },
) => {
  const cfg = ctx.config;
  const store = new AxiomStore(cfg);
  const { axioms } = store.all();
  const axiom = axioms.find((candidate) => candidate.id === id);

  if (!axiom) throw errors.axiomNotFound(id);

  if (axiom.status !== "active") throw errors.axiomNotActive(id);

  store.deprecate(id);
  new TriageStore(cfg).writeSession([
    { kind: "deprecation", axiom_id: id, reason, timestamp: new Date().toISOString() },
  ]);

  ctx.render([
    {
      channel: "success",
      text: `${id} is deprecated: ${reason}. Its records stay readable; unidentified critiques re-queue for triage against the reduced set.`,
    },
  ]);

  return "ok";
};

export default prepareOrchestrator(deprecateAxiomOrchestrator);
