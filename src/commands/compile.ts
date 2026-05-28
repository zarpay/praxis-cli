import { watch, type FSWatcher } from "node:fs";
import { resolve } from "node:path";

import type { Command } from "commander";
import fg from "fast-glob";

import { Frontmatter } from "@/compiler/frontmatter.js";
import { RoleCompiler } from "@/compiler/role-compiler.js";
import { PraxisConfig } from "@/core/config.js";
import { Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";

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
        const paths = new Paths();
        const config = new PraxisConfig(paths.root);
        const compiler = new RoleCompiler({ root: paths.root, logger, config });

        if (options.alias) {
          await compileOne(config, compiler, logger, options.alias);
          if (options.watch) {
            logger.warn("--watch is not supported with --alias, ignoring");
          }
          return;
        }

        await compiler.compileAll();

        if (options.watch) {
          watchAndRecompile(paths.root, config, compiler, logger);
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Watches source directories and recompiles on changes.
 *
 * Uses `fs.watch` with recursive mode to detect file changes.
 * Debounces rapid changes to avoid redundant compilations.
 *
 * @param root - Project root directory
 * @param config - PraxisConfig instance
 * @param compiler - RoleCompiler instance
 * @param logger - Logger instance
 * @param options - Configuration overrides (debounce timing)
 * @returns Array of FSWatcher instances (one per source directory)
 */
export function watchAndRecompile(
  root: string,
  config: PraxisConfig,
  compiler: RoleCompiler,
  logger: Logger,
  options?: { debounceMs?: number },
): FSWatcher[] {
  const debounceMs = options?.debounceMs ?? 300;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const watchers: FSWatcher[] = [];

  for (const source of config.sources) {
    const sourceDir = resolve(root, source);
    logger.info(`Watching ${sourceDir} for changes...`);

    const watcher = watch(sourceDir, { recursive: true }, (_event, filename) => {
      if (timer) clearTimeout(timer);

      timer = setTimeout(async () => {
        try {
          logger.info(`Change detected${filename ? `: ${String(filename)}` : ""}, recompiling...`);
          await compiler.compileAll();
        } catch (err) {
          logger.error(err instanceof Error ? err.message : String(err));
        }
      }, debounceMs);
    });

    watchers.push(watcher);
  }

  return watchers;
}

/**
 * Compiles a single agent by looking up its role file via alias.
 *
 * Searches all role files in the roles directory for one whose
 * `alias` frontmatter field matches the target (case-insensitive).
 */
async function compileOne(
  config: PraxisConfig,
  compiler: RoleCompiler,
  logger: Logger,
  aliasName: string,
): Promise<void> {
  const roleFile = await findRoleByAlias(config.rolesDir, aliasName);

  if (!roleFile) {
    logger.error(`No role found with alias: ${aliasName}`);
    process.exit(1);
  }

  await compiler.compile(roleFile);
}

/**
 * Searches role files for one matching the given alias.
 *
 * @param rolesDir - Absolute path to the roles directory
 * @param targetAlias - The alias to search for (case-insensitive)
 * @returns The absolute path to the matching role file, or null
 */
async function findRoleByAlias(rolesDir: string, targetAlias: string): Promise<string | null> {
  const roleFiles = await fg("*.md", {
    cwd: rolesDir,
    onlyFiles: true,
    absolute: true,
  });

  for (const roleFile of roleFiles) {
    const fm = new Frontmatter(roleFile);
    const alias = fm.value("alias") as string | undefined;
    if (alias?.toLowerCase() === targetAlias.toLowerCase()) {
      return roleFile;
    }
  }

  return null;
}
