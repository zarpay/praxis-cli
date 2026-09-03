import type { AddDocumentOptions } from "@/types.js";
import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { PracticeStore } from "@/stores/practice-store.js";
import documentCreatedView from "@/views/document-created-view.js";

/**
 * What `praxis add practice <name>` does: scaffold one practice from its
 * template and say where it landed.
 */
export const addPracticeOrchestrator: Orchestrator<AddDocumentOptions> = async (ctx, { name }) => {
  const store = new PracticeStore(ctx.config);
  const created = store.add(name);

  const view = documentCreatedView(created);
  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(addPracticeOrchestrator);
