import type { Logger } from "@/core/logger.js";
import type { PluginConfigEntry } from "@/core/config.js";

import { ClaudeCodePlugin } from "./plugins/claude-code.js";
import type { CompilerPlugin, PluginOptions } from "./plugins/types.js";

/** Constructor signature every compiler plugin class must satisfy. */
type PluginConstructor = new (options: PluginOptions) => CompilerPlugin;

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
export function resolvePlugins(
  entries: PluginConfigEntry[],
  root: string,
  logger: Logger,
): CompilerPlugin[] {
  return entries.map((entry) => {
    const Constructor = PLUGINS[entry.name];
    if (!Constructor) {
      const available = Object.keys(PLUGINS).join(", ");
      throw new Error(`Unknown plugin: "${entry.name}". Available plugins: ${available}`);
    }
    return new Constructor({ root, logger, pluginConfig: entry });
  });
}
