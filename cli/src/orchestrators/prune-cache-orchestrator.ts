import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import pruneCacheService from "@/services/prune-cache-service.js";
import pruneView from "@/views/prune-view.js";

/**
 * What `praxis eval prune` does: drop cached verdicts no configured
 * reviewer can ever hit again — the leftovers of renamed models, retired
 * reviewers, and rolled epochs.
 */
export const pruneCacheOrchestrator: Orchestrator = async (ctx) => {
  const result = pruneCacheService({ root: ctx.root, config: ctx.config });

  ctx.render(pruneView(result));

  return "ok";
};

export default prepareOrchestrator(pruneCacheOrchestrator);
