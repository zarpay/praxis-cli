import type { AddDocumentOptions } from "@/spec/types.js";
import type { Orchestrator } from "@/workspace/types.js";

import { renderReport } from "@/framework/views/report.js";
import addDocumentService from "@/spec/services/add-document-service.js";
import { prepareOrchestrator } from "@/workspace/prepare-orchestrator.js";

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
