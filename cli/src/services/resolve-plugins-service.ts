import type { CompilerPlugin, CompilerPluginOptions } from "@/types.js";
import type { Service } from "@/types.js";
import type { Logger } from "@framework/views/logger.js";

import { errors } from "@/helpers/errors-helper.js";
import { ClaudeCodePlugin } from "@/plugins/claude-code.js";

/** Constructor signature every compiler plugin class must satisfy. */
type PluginConstructor = new (options: CompilerPluginOptions) => CompilerPlugin;

/** The diagnostic channel plugin constructors receive. */
interface ResolvePluginsInput {
  logger: Logger;
}

/** Registry of available plugins, keyed by the name used in config.json. */
const PLUGINS: Record<string, PluginConstructor> = {
  "claude-code": ClaudeCodePlugin,
};

/**
 * Resolves the config's plugin entries to instantiated compiler plugins.
 *
 * @throws PraxisError if an unknown plugin name is encountered
 */
const resolvePluginsService: Service<ResolvePluginsInput, CompilerPlugin[]> = (cfg, { logger }) => {
  return cfg.plugins.map((entry) => {
    const Constructor = PLUGINS[entry.name];

    if (!Constructor) {
      throw errors.unknownPlugin(entry.name, Object.keys(PLUGINS));
    }

    return new Constructor({ root: cfg.root, logger, pluginConfig: entry });
  });
};

export default resolvePluginsService;
