import type { Orchestrator } from "@/types.js";

import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import { Reviewer } from "@/models/reviewer.js";
import { VerdictStore } from "@/stores/verdict-store.js";
import pruneView from "@/views/prune-view.js";

/**
 * What `praxis eval prune` does: drop cached verdicts no configured
 * reviewer can ever hit again — the leftovers of renamed models, retired
 * reviewers, and rolled epochs.
 */
export const pruneCacheOrchestrator: Orchestrator = async (ctx) => {
  const liveHashes = new Set(
    ctx.config.reviewers.map((reviewer) => Reviewer.fromConfig(reviewer).hash()),
  );
  const store = new VerdictStore({ projectRoot: ctx.root });
  const result = store.prune(liveHashes);

  ctx.render(pruneView(result));

  return "ok";
};

export default prepareOrchestrator(pruneCacheOrchestrator);
