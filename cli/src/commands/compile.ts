import type { Command } from "commander";

import type { FSWatcher } from "@/core/files.js";
import type { CompileProgress, CompileScope } from "@/domains/spec/types.js";
import type { PraxisProjectBaseOptions } from "@/types.js";

import fg from "fast-glob";

import { runAction } from "@/commands/action.js";
import { PraxisProjectBase } from "@/core/base.js";
import { errors } from "@/core/errors.js";
import { watchDir } from "@/core/files.js";
import { Paths, resolvePath } from "@/core/paths.js";
import { ExpertFile } from "@/domains/spec/models/expert-file.js";
import compileExpert from "@/domains/spec/orchestrators/compile-expert.js";
import compileExperts from "@/domains/spec/orchestrators/compile-experts.js";
import resolvePlugins from "@/domains/spec/services/plugin-registry.js";
import { Logger } from "@/views/logger.js";

/**
 * Registers the `praxis compile` command.
 *
 * Compiles role definitions into agent profile files and runs
 * any enabled plugins (e.g. Claude Code) based on .praxis/config.json.
 */
export function registerCompileCommand(program: Command): void {
  program
    .command("compile")
    .description("Compile role definitions into agent files")
    .option("--alias <name>", "compile a specific agent by alias")
    .option("--watch", "watch source directories for changes and recompile")
    .action((options: { alias?: string; watch?: boolean }) =>
      runAction(async () => {
        const logger = new Logger();
        const command = new CompileCommand({ root: new Paths().root, logger });

        if (options.alias) {
          await command.compileAlias(options.alias);

          if (options.watch) {
            logger.warn("--watch is not supported with --alias, ignoring");
          }

          return;
        }

        await command.compileAll();

        if (options.watch) {
          command.watch();
        }
      }),
    );
}

/**
 * Compiles role definitions, by alias or in bulk, with optional watching.
 *
 * Wiring only: it builds the compile scope from config, calls an
 * orchestrator, and renders the progress events the orchestrator emits.
 * Alias lookup and the watch loop are the CLI's own concerns.
 */
export class CompileCommand extends PraxisProjectBase {
  constructor(options: PraxisProjectBaseOptions) {
    super(options);
  }

  /** Compiles all role files in the project's roles directory. */
  async compileAll(): Promise<{ compiled: number }> {
    const { compiled } = await compileExperts({
      ...this.scope(),
      expertsDir: this.config.expertsDir,
      onProgress: (event) => this.render(event),
    });

    this.logger.info(`Compiled ${compiled} agent(s) (up-to-date)`);
    return { compiled };
  }

  /**
   * Compiles a single agent by looking up its role file via alias.
   *
   * @param alias - The role alias to compile (case-insensitive)
   * @throws PraxisError if no role file declares the alias
   */
  async compileAlias(alias: string): Promise<void> {
    const expertFile = await this.findExpertByAlias(alias);

    if (!expertFile) {
      throw errors.expertNotFound(alias);
    }

    const result = await compileExpert({ ...this.scope(), expertFile });

    for (const message of result.warnings) {
      this.logger.warn(message);
    }

    this.logger.success(`Compiled ${result.alias.toLowerCase()}.md`);
  }

  /**
   * Watches source directories and recompiles on changes.
   *
   * Uses `fs.watch` with recursive mode to detect file changes.
   * Debounces rapid changes to avoid redundant compilations.
   *
   * @param options - Configuration overrides (debounce timing)
   * @returns Array of FSWatcher instances (one per source directory);
   *   callers that need to stop watching close them
   */
  watch(options?: { debounceMs?: number }): FSWatcher[] {
    const debounceMs = options?.debounceMs ?? 300;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const watchers: FSWatcher[] = [];

    for (const source of this.config.sources) {
      const sourceDir = resolvePath(this.root, source);
      this.logger.info(`Watching ${sourceDir} for changes...`);

      const watcher = watchDir(sourceDir, (filename) => {
        if (timer) clearTimeout(timer);

        timer = setTimeout(async () => {
          try {
            this.logger.info(`Change detected${filename ? `: ${filename}` : ""}, recompiling...`);
            await this.compileAll();
          } catch (err) {
            this.logger.error(err instanceof Error ? err.message : String(err));
          }
        }, debounceMs);
      });

      watchers.push(watcher);
    }

    return watchers;
  }

  /**
   * The project's compile scope.
   *
   * Plugins are constructed once per command, not per expert: the
   * Claude Code plugin writes its manifest on first compile and must
   * not repeat it for every agent.
   */
  private scope(): CompileScope {
    return {
      root: this.root,
      specFilePattern: this.config.specFilePattern,
      agentProfilesOutputDir: this.config.agentProfilesOutputDir,
      plugins: resolvePlugins(this.config.plugins, this.root, this.logger),
    };
  }

  /** Renders one compile event as it happens. */
  private render(event: CompileProgress): void {
    if (event.kind === "compiled") {
      this.logger.success(`Compiled ${event.alias.toLowerCase()}.md`);
    } else if (event.kind === "skipped") {
      this.logger.warn(`Skipping ${event.file}: ${event.reason}`);
    } else {
      this.logger.warn(event.message);
    }
  }

  /**
   * Searches role files for one matching the given alias.
   *
   * @param targetAlias - The alias to search for (case-insensitive)
   * @returns The absolute path to the matching role file, or null
   */
  private async findExpertByAlias(targetAlias: string): Promise<string | null> {
    const expertFiles = await fg("*.md", {
      cwd: this.config.expertsDir,
      onlyFiles: true,
      absolute: true,
    });

    for (const expertFile of expertFiles) {
      // A malformed neighbour is not this search's problem — compiling
      // it is what surfaces the error, with the full message.
      const alias = readAlias(expertFile);

      if (alias?.toLowerCase() === targetAlias.toLowerCase()) {
        return expertFile;
      }
    }

    return null;
  }
}

/** An expert's alias, or null when the file cannot be read as an expert. */
function readAlias(expertFile: string): string | null {
  try {
    return ExpertFile.at(expertFile).alias;
  } catch {
    return null;
  }
}
