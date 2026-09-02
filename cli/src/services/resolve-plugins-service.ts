import type { CompilerPlugin, PluginConstructor } from "@/types.js";
import type { PluginConfigEntry } from "@/types.js";
import type { Logger } from "@framework/views/logger.js";

import { errors } from "@/helpers/errors-helper.js";
import { ClaudeCodePlugin } from "@/plugins/claude-code.js";

/** Registry of available plugins, keyed by the name used in config.json. */
const PLUGINS: Record<string, PluginConstructor> = {
  "claude-code": ClaudeCodePlugin,
};

/**
 * Resolves plugin config entries to instantiated compiler plugins.
 *
 * @param entries - Array of normalized plugin config entries
 * @param root - Project root directory
 * @param logger - Logger instance
 * @returns Array of instantiated plugins
 * @throws Error if an unknown plugin name is encountered
 */
export default function resolvePlugins(
  entries: PluginConfigEntry[],
  root: string,
  logger: Logger,
): CompilerPlugin[] {
  return entries.map((entry) => {
    const Constructor = PLUGINS[entry.name];

    if (!Constructor) {
      throw errors.unknownPlugin(entry.name, Object.keys(PLUGINS));
    }

    return new Constructor({ root, logger, pluginConfig: entry });
  });
}
