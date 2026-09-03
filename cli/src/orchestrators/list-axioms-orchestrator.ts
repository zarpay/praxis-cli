import type { ListAxiomsOptions, Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import axiomListView from "@/views/axiom-list-view.js";

/**
 * What `praxis axioms list` does: render the axiom store.
 *
 * An unreadable axiom file fails the command — a store the taxonomy
 * cannot fully read is a problem to fix now, not a footnote — but never
 * hides the axioms that did load.
 */
export const listAxiomsOrchestrator: Orchestrator<ListAxiomsOptions> = async (
  ctx,
  { json = false },
) => {
  const { axioms, problems } = new AxiomStore({ projectRoot: ctx.root }).all();
  const view = axiomListView({ axioms, problems, json });

  ctx.render(view);

  return problems.length === 0 ? "ok" : "failed";
};

export default prepareOrchestrator(listAxiomsOrchestrator);
