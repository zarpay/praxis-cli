import type { AddDocumentOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import addDocumentService from "@/services/add-document-service.js";
import { renderReport } from "@framework/views/report.js";

/**
 * What `praxis add expert <name>` does: scaffold one expert from its
 * template and say where it landed.
 */
export const addExpertOrchestrator: Orchestrator<AddDocumentOptions> = async (ctx, { name }) => {
  const created = addDocumentService({
    type: "expert",
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

export default prepareOrchestrator(addExpertOrchestrator);
