import type { AddDocumentOptions } from "@/domains/spec/types.js";
import type { Orchestrator } from "@/domains/workspace/types.js";

import addDocumentService from "@/domains/spec/services/add-document-service.js";
import { prepareOrchestrator } from "@/domains/workspace/prepare-orchestrator.js";
import { renderReport } from "@/framework/views/report.js";

/**
 * What `praxis add practice <name>` does: scaffold one practice from its
 * template and say where it landed.
 */
export const addPracticeOrchestrator: Orchestrator<AddDocumentOptions> = async (
  ctx,
  { name, scaffoldDir },
) => {
  const created = addDocumentService({
    type: "practice",
    name,
    scaffoldDir,
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
