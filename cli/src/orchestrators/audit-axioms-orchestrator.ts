import type { Orchestrator } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import assessAxiomGateService from "@/services/assess-axiom-gate-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import auditView from "@/views/audit-view.js";

/** Options for `praxis axioms audit`. */
interface AuditAxiomsOptions {
  json?: boolean;
}

/**
 * What `praxis axioms audit` does: the authoring gate re-assessed over
 * every active axiom (03) — tooling capability grows, and an axiom
 * appropriate last year may be delegable now.
 *
 * Advisory only: the report names removal candidates; deprecating is a
 * human edit, and history stays frozen (04).
 *
 * @throws PraxisError without a curator
 */
export const auditAxiomsOrchestrator: Orchestrator<AuditAxiomsOptions> = async (
  ctx,
  { json = false },
) => {
  const cfg = ctx.config;

  if (!cfg.curator) throw errors.curatorNotConfigured();

  const { axioms } = new AxiomStore(cfg).all();
  const active = axioms.filter((axiom) => axiom.status === "active");

  const rows = [];

  for (const axiom of active) {
    const others = active
      .filter((candidate) => candidate.id !== axiom.id)
      .map((candidate) => ({ id: candidate.id, statement: candidate.statement() }));

    const gate = await assessAxiomGateService(cfg, {
      statement: axiom.statement(),
      violatingExample: axiom.violatingExample(),
      compliantExample: axiom.compliantExample(),
      existing: others,
    });

    rows.push({
      id: axiom.id,
      assessment: gate.assessment,
      reasoning: gate.reasoning,
      duplicateOf: gate.duplicateOf,
    });
  }

  const view = auditView({ rows, json });

  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(auditAxiomsOrchestrator);
