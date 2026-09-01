import type { CommandContext } from "@/domains/workspace/models/command-context.js";
import type { ShowConfigResult } from "@/domains/workspace/types.js";

import { readJson } from "@/core/files.js";

/**
 * The project's configuration, as written.
 *
 * Deliberately the raw file rather than the normalized `PraxisConfig`:
 * `praxis config show` exists so an author can see what *they* wrote
 * and where it lives, not what the defaults turned it into.
 *
 * @throws PraxisError when the file is absent or is not valid JSON
 */
export default function showConfig(ctx: CommandContext): ShowConfigResult {
  const configPath = ctx.paths.configFile;

  return { configPath, config: readJson(configPath) };
}
