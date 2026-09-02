import type { Orchestrator } from "@/workspace/types.js";

import { readJson } from "@/framework/files.js";
import { prepareOrchestrator } from "@/workspace/prepare-orchestrator.js";
import { configEntries } from "@/workspace/views/config.js";

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

  ctx.out.print(configEntries(configPath, readJson(configPath)));
};

export default prepareOrchestrator(showConfigOrchestrator);
