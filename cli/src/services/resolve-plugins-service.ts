import type { CompilerPlugin, PluginConstructor } from "@/types.js";
import type { ResolvePluginsInput, Service } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { ClaudeCodePlugin } from "@/plugins/claude-code.js";

/** Registry of available plugins, keyed by the name used in config.json. */
const PLUGINS: Record<string, PluginConstructor> = {
  "claude-code": ClaudeCodePlugin,
};

/**
 * Resolves the config's plugin entries to instantiated compiler plugins.
 *
 * @throws PraxisError if an unknown plugin name is encountered
 */
const resolvePluginsService: Service<ResolvePluginsInput, CompilerPlugin[]> = (
  config,
  { logger },
) => {
  return config.plugins.map((entry) => {
    const Constructor = PLUGINS[entry.name];

    if (!Constructor) {
      throw errors.unknownPlugin(entry.name, Object.keys(PLUGINS));
    }

    return new Constructor({ root: config.root, logger, pluginConfig: entry });
  });
};

export default resolvePluginsService;
