import type { AddDocumentOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import addDocumentService from "@/services/add-document-service.js";
import { renderReport } from "@framework/views/report.js";

/**
 * What `praxis add practice <name>` does: scaffold one practice from its
 * template and say where it landed.
 */
export const addPracticeOrchestrator: Orchestrator<AddDocumentOptions> = async (ctx, { name }) => {
  const created = addDocumentService({
    type: "practice",
    name,
    root: ctx.root,
    expertsDir: ctx.config.expertsDir,
    practicesDir: ctx.config.practicesDir,
  });

  renderReport([{ channel: "success", text: `Created ${created.type}: ${created.path}` }], {
    out: ctx.out,
    logger: ctx.logger,
  });
};

export default prepareOrchestrator(addPracticeOrchestrator);
