import type { CommandContext } from "@/domains/workspace/models/command-context.js";

import { readJson } from "@/core/files.js";
import { configEntries } from "@/domains/workspace/views/config.js";

/**
 * What `praxis config show` does: print the configuration as written.
 *
 * Deliberately the raw file rather than the normalized `PraxisConfig`:
 * the command exists so an author can see what *they* wrote and where it
 * lives, not what the defaults turned it into.
 *
 * @throws PraxisError when the file is absent or is not valid JSON
 */
export default async function showConfig(ctx: CommandContext): Promise<void> {
  const configPath = ctx.paths.configFile;

  ctx.out.print(configEntries(configPath, readJson(configPath)));
}
