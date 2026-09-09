import type { Orchestrator } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildCritiquesReportService from "@/services/build-critiques-report-service.js";
import { AxiomStore } from "@/stores/axiom-store.js";
import axiomShowView from "@/views/axiom-show-view.js";

/** Options for `praxis axioms show <id>`. */
interface ShowAxiomOptions {
  id: string;
  json?: boolean;
}

/**
 * What `praxis axioms show <id>` does: one category in full — the
 * statement naming the issue, the spec passage the norm lives in, and
 * the category's real examples: its labeled critiques from the ledger.
 *
 * @throws PraxisError when no axiom carries the id
 */
export const showAxiomOrchestrator: Orchestrator<ShowAxiomOptions> = async (
  ctx,
  { id, json = false },
) => {
  const { axioms } = new AxiomStore(ctx.config).all();
  const axiom = axioms.find((candidate) => candidate.id === id);

  if (!axiom) throw errors.axiomNotFound(id);

  const { rows } = buildCritiquesReportService(ctx.config, { axiom: id });
  const critiques = rows.slice(0, 5).map((row) => ({
    id: row.id,
    filePath: row.filePath,
    reviewerName: row.reviewerName,
    text: row.text,
  }));

  const view = axiomShowView({ axiom, critiques, labeledCount: rows.length, json });

  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(showAxiomOrchestrator);
