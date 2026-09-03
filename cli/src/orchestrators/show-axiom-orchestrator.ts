import type { Orchestrator, ShowAxiomOptions } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import axiomShowView from "@/views/axiom-show-view.js";

/**
 * What `praxis axioms show <id>` does: one axiom in full — the
 * drill-down behind every finding that cites an id (08, 09).
 *
 * @throws PraxisError when no axiom carries the id
 */
export const showAxiomOrchestrator: Orchestrator<ShowAxiomOptions> = async (
  ctx,
  { id, json = false },
) => {
  const { axioms } = new AxiomStore({ projectRoot: ctx.root }).all();
  const axiom = axioms.find((candidate) => candidate.id === id);

  if (!axiom) throw errors.axiomNotFound(id);

  const view = axiomShowView({ axiom, json });

  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(showAxiomOrchestrator);
