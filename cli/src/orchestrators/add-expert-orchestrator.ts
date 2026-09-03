import type { AddDocumentOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { ExpertStore } from "@/stores/expert-store.js";
import documentCreatedView from "@/views/document-created-view.js";

/**
 * What `praxis add expert <name>` does: scaffold one expert from its
 * template and say where it landed.
 */
export const addExpertOrchestrator: Orchestrator<AddDocumentOptions> = async (ctx, { name }) => {
  const store = new ExpertStore({
    expertsDir: ctx.config.expertsDir,
    specFilePattern: ctx.config.specFilePattern,
  });
  const created = store.add(name, ctx.root);

  const view = documentCreatedView(created);
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(addExpertOrchestrator);
