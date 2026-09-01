import type { Command } from "commander";

import type { CompileExpertsInput, CompileProgress } from "@/domains/spec/types.js";

import { runAction } from "@/commands/action.js";
import compileByAlias from "@/domains/spec/orchestrators/compile-by-alias.js";
import compileExperts from "@/domains/spec/orchestrators/compile-experts.js";
import watchAndCompile from "@/domains/spec/orchestrators/watch-and-compile.js";
import resolvePlugins from "@/domains/spec/services/resolve-plugins.js";
import { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";
import { Logger } from "@/views/logger.js";

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

          for (const message of result.warnings) logger.warn(message);

          logger.success(`Compiled ${result.alias.toLowerCase()}.md`);

          if (options.watch) {
            logger.warn("--watch is not supported with --alias, ignoring");
          }

          return;
        }

        const { compiled } = await compileExperts(input);
        logger.info(`Compiled ${compiled} agent(s) (up-to-date)`);

        if (options.watch) {
          watchAndCompile({
            ...input,
            sources: config.sources,
            onWatch: (dir) => logger.info(`Watching ${dir} for changes...`),
            onRecompile: (filename) =>
              logger.info(`Change detected${filename ? `: ${filename}` : ""}, recompiling...`),
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
      onProgress: (event) => renderProgress(logger, event),
    },
  };
}

/** Renders one compile event as it happens. */
function renderProgress(logger: Logger, event: CompileProgress): void {
  if (event.kind === "compiled") {
    logger.success(`Compiled ${event.alias.toLowerCase()}.md`);
  } else if (event.kind === "skipped") {
    logger.warn(`Skipping ${event.file}: ${event.reason}`);
  } else {
    logger.warn(event.message);
  }
}
