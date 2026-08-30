import type { Command } from "commander";

import type { FSWatcher } from "@/core/files.js";

import fg from "fast-glob";

import { ExpertCompiler } from "@/spec/expert-compiler.js";
import { Frontmatter } from "@/core/frontmatter.js";
import { PraxisConfig } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { watchDir } from "@/core/files.js";
import { Logger } from "@/core/logger.js";
import { Paths, resolvePath } from "@/core/paths.js";

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
    .action(async (options: { alias?: string; watch?: boolean }) => {
      const logger = new Logger();

      try {
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
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Compiles role definitions, by alias or in bulk, with optional watching.
 *
 * A thin command layer over ExpertCompiler: adds alias lookup and the
 * watch loop, while ExpertCompiler owns the actual compilation.
 */
export class CompileCommand {
  private readonly root: string;
  private readonly config: PraxisConfig;
  private readonly logger: Logger;
  private readonly compiler: ExpertCompiler;

  constructor({
    root,
    config,
    logger = new Logger(),
  }: {
    root: string;
    config?: PraxisConfig;
    logger?: Logger;
  }) {
    this.root = root;
    this.config = config ?? new PraxisConfig(root);
    this.logger = logger;
    this.compiler = new ExpertCompiler({ root, logger, config: this.config });
  }

  /** Compiles all role files in the project's roles directory. */
  async compileAll(): Promise<{ compiled: number }> {
    return this.compiler.compileAll();
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

    await this.compiler.compile(expertFile);
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
            await this.compiler.compileAll();
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
      const fm = Frontmatter.fromFile(expertFile);
      const alias = fm.value("alias") as string | undefined;

      if (alias?.toLowerCase() === targetAlias.toLowerCase()) {
        return expertFile;
      }
    }

    return null;
  }
}
