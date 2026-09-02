import type { AddDocumentOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import addDocumentService from "@/services/add-document-service.js";
import documentCreatedView from "@/views/document-created-view.js";

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

  ctx.render(documentCreatedView(created));

  return "ok";
};

export default prepareOrchestrator(addExpertOrchestrator);
