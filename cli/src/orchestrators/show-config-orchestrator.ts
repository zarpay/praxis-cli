import type { Orchestrator } from "@/types.js";

import { readJson } from "@/helpers/files-helper.js";
import { prepareOrchestrator } from "@/helpers/prepare-orchestrator-helper.js";
import configView from "@/views/config-view.js";

/**
 * What `praxis config show` does: print the configuration as written.
 *
 * Deliberately the raw file rather than the normalized `PraxisConfig`:
 * the command exists so an author can see what *they* wrote and where it
 * lives, not what the defaults turned it into.
 *
 * @throws PraxisError when the file is absent or is not valid JSON
 */
export const showConfigOrchestrator: Orchestrator = async (ctx) => {
  const configPath = ctx.paths.configFile;

  ctx.render(configView({ configPath, config: readJson(configPath) }));
};

export default prepareOrchestrator(showConfigOrchestrator);
