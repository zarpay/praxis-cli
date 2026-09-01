import type { Command } from "commander";

import type { CompileExpertsInput } from "@/domains/spec/types.js";

import { runAction } from "@/commands/action.js";
import compileByAlias from "@/domains/spec/orchestrators/compile-by-alias.js";
import compileExperts from "@/domains/spec/orchestrators/compile-experts.js";
import watchAndCompile from "@/domains/spec/orchestrators/watch-and-compile.js";
import resolvePlugins from "@/domains/spec/services/resolve-plugins.js";
import {
  compileProgressLine,
  compiledCount,
  compiledOneLines,
  recompilingLine,
  watchingLine,
} from "@/domains/spec/views/compile-progress.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import { Logger } from "@/views/logger.js";
import { renderReport } from "@/views/report.js";

/**
 * Registers the `praxis compile` command.
 *
 * Compiles expert definitions into agent profiles and runs any enabled
 * plugins, per .praxis/config.json.
 */
export function registerCompileCommand(program: Command): void {
  program
    .command("compile")
    .description("Compile expert definitions into agent files")
    .option("--alias <name>", "compile a specific agent by alias")
    .option("--watch", "watch source directories for changes and recompile")
    .action((options: { alias?: string; watch?: boolean }) =>
      runAction(async () => {
        const logger = new Logger();
        const { config, input } = compileInput(logger);

        if (options.alias) {
          const result = await compileByAlias({
            ...input,
            alias: options.alias,
            expertsDir: config.expertsDir,
          });

          renderReport(compiledOneLines(result.alias, result.warnings), { logger });

          if (options.watch) {
            logger.warn("--watch is not supported with --alias, ignoring");
          }

          return;
        }

        const { compiled } = await compileExperts(input);

        renderReport([compiledCount(compiled)], { logger });

        if (options.watch) {
          watchAndCompile({
            ...input,
            sources: config.sources,
            onWatch: (dir) => renderReport([watchingLine(dir)], { logger }),
            onRecompile: (filename) => renderReport([recompilingLine(filename)], { logger }),
            onError: (message) => logger.error(message),
          });
        }
      }),
    );
}

/**
 * The compile scope for this invocation.
 *
 * Plugins are constructed once per command, not per expert: the Claude
 * Code plugin writes its manifest on first compile and must not repeat
 * it for every agent.
 */
function compileInput(logger: Logger): {
  root: string;
  config: PraxisConfig;
  input: CompileExpertsInput;
} {
  const root = new Paths().root;
  const config = new PraxisConfig(root);

  return {
    root,
    config,
    input: {
      root,
      expertsDir: config.expertsDir,
      specFilePattern: config.specFilePattern,
      agentProfilesOutputDir: config.agentProfilesOutputDir,
      plugins: resolvePlugins(config.plugins, root, logger),
      onProgress: (event) => renderReport([compileProgressLine(event)], { logger }),
    },
  };
}
