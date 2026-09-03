import type { Orchestrator } from "@/types.js";

import { PraxisError } from "@/helpers/errors-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import buildOrientationService from "@/services/build-orientation-service.js";
import orientationView from "@/views/orientation-view.js";

/**
 * What bare `praxis` does: the orientation screen (09-h) — counts and
 * staleness at a glance, each line naming its command.
 *
 * Outside a praxis project there is nothing to orient in, so the screen
 * degrades to the pointer that matters: `praxis init`.
 */
export const orientProjectOrchestrator: Orchestrator = async (ctx) => {
  try {
    void ctx.root;
  } catch (err) {
    if (!(err instanceof PraxisError)) throw err;

    ctx.render([
      {
        channel: "content",
        entries: [
          "Not a praxis project. `praxis init` creates one; `praxis --help` lists commands.",
        ],
      },
    ]);

    return "ok";
  }

  const orientation = buildOrientationService(ctx.config, {});
  const view = orientationView(orientation);

  ctx.render(view);

  return "ok";
};

export default prepareOrchestrator(orientProjectOrchestrator);
