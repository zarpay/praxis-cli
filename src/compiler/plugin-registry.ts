import type { Logger } from "@/core/logger.js";

import { ClaudeCodePlugin } from "./plugins/claude-code.js";
import type { CompilerPlugin, PluginOptions } from "./plugins/types.js";

type PluginConstructor = new (options: PluginOptions) => CompilerPlugin;

const PLUGINS: Record<string, PluginConstructor> = {
  "claude-code": ClaudeCodePlugin,
};

/**
 * Resolves plugin names to instantiated compiler plugins.
 *
 * @param names - Array of plugin name strings from config
 * @param root - Project root directory
 * @param logger - Logger instance
 * @returns Array of instantiated plugins
 * @throws Error if an unknown plugin name is encountered
 */
export function resolvePlugins(
  names: string[],
  root: string,
  logger: Logger,
  pluginsOutputDir?: string,
  pluginName?: string,
): CompilerPlugin[] {
  return names.map((name) => {
    const Constructor = PLUGINS[name];
    if (!Constructor) {
      const available = Object.keys(PLUGINS).join(", ");
      throw new Error(`Unknown plugin: "${name}". Available plugins: ${available}`);
    }
    return new Constructor({ root, logger, pluginsOutputDir, pluginName });
  });
}
