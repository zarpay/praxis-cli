import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { Command } from "commander";

import { PraxisConfig } from "@/core/config.js";
import { Logger } from "@/core/logger.js";

/**
 * Resolved path to the scaffold directory shipped with the package.
 *
 * At runtime, `import.meta.dirname` resolves to `dist/` (the built output).
 * The scaffold directory sits one level up at the package root.
 */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "scaffold");

/**
 * Registers the `praxis init` command.
 *
 * Scaffolds a new Praxis project by copying core framework files and
 * plugin-specific files based on config into the target directory.
 */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new Praxis project")
    .argument("[directory]", "target directory (defaults to current directory)", ".")
    .action((directory: string) => {
      const logger = new Logger();
      try {
        new InitCommand({ targetDir: resolve(directory), logger }).init();
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Scaffolds a Praxis project into a target directory.
 *
 * init() performs three steps:
 * 1. Copies all core scaffold files (content, config, README, etc.)
 * 2. Reads the scaffolded config to determine which plugins are enabled
 * 3. Copies plugin-specific scaffold files for each enabled plugin
 *
 * Files that already exist are skipped, never overwritten, which also
 * makes init idempotent.
 */
export class InitCommand {
  private readonly targetDir: string;
  private readonly scaffoldDir: string;
  private readonly logger: Logger;

  constructor({
    targetDir,
    scaffoldDir = SCAFFOLD_DIR,
    logger = new Logger(),
  }: {
    targetDir: string;
    scaffoldDir?: string;
    logger?: Logger;
  }) {
    this.targetDir = targetDir;
    this.scaffoldDir = scaffoldDir;
    this.logger = logger;
  }

  /** Runs the scaffold, logging each created file and a final summary. */
  init(): void {
    if (!existsSync(this.targetDir)) {
      mkdirSync(this.targetDir, { recursive: true });
    }

    let created = 0;
    let skipped = 0;

    // Step 1: Copy core scaffold files
    const coreResult = this.copyCoreScaffold();
    created += coreResult.created;
    skipped += coreResult.skipped;

    // Step 2: Read config to determine which plugins to scaffold
    const config = new PraxisConfig(this.targetDir);

    // Step 3: Copy plugin scaffold files for each enabled plugin
    for (const pluginEntry of config.plugins) {
      const pluginScaffoldDir = join(this.scaffoldDir, "plugins", pluginEntry.name);
      if (!existsSync(pluginScaffoldDir)) {
        continue;
      }

      // Resolve the plugin output directory within the target
      const pluginOutputDir = pluginEntry.outputDir
        ? resolve(this.targetDir, pluginEntry.outputDir)
        : join(this.targetDir, "plugins", "praxis");

      const templateVars: Record<string, string> = {
        claudeCodePluginName: pluginEntry.claudeCodePluginName ?? "praxis",
      };

      const pluginResult = this.copyPluginScaffold(
        pluginScaffoldDir,
        pluginOutputDir,
        templateVars,
      );
      created += pluginResult.created;
      skipped += pluginResult.skipped;
    }

    console.log();
    this.logger.info(`Initialized Praxis project: ${created} files created, ${skipped} skipped`);
    console.log();
    console.log("Next steps:");
    console.log("  1. Edit context/constitution/ to define your organization's identity");
    console.log("  2. Edit context/conventions/ to document your standards");
    console.log("  3. Run `praxis compile` to generate agent files");
    console.log("  4. Define new roles in roles/ as your organization grows");
  }

  /**
   * Copies all core scaffold files into the target directory.
   *
   * @returns Count of files created and skipped
   */
  private copyCoreScaffold(): { created: number; skipped: number } {
    const sourceDir = join(this.scaffoldDir, "core");
    let created = 0;
    let skipped = 0;

    for (const relPath of this.walkDir(sourceDir)) {
      const srcPath = join(sourceDir, relPath);
      const destPath = join(this.targetDir, relPath);
      const destDir = dirname(destPath);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      if (existsSync(destPath)) {
        skipped++;
        continue;
      }

      copyFileSync(srcPath, destPath);
      this.logger.success(`Created ${relPath}`);
      created++;
    }

    return { created, skipped };
  }

  /**
   * Copies plugin scaffold files into the resolved plugin output directory.
   *
   * Replaces template variables (e.g. `{claudeCodePluginName}`) in `.json` file contents.
   *
   * @param sourceDir - Plugin scaffold source directory
   * @param targetPluginDir - Resolved output directory for this plugin
   * @param templateVars - Template variables to substitute in JSON files
   * @returns Count of files created and skipped
   */
  private copyPluginScaffold(
    sourceDir: string,
    targetPluginDir: string,
    templateVars: Record<string, string>,
  ): { created: number; skipped: number } {
    let created = 0;
    let skipped = 0;

    for (const relPath of this.walkDir(sourceDir)) {
      const srcPath = join(sourceDir, relPath);
      const destPath = join(targetPluginDir, relPath);
      const destDir = dirname(destPath);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      if (existsSync(destPath)) {
        skipped++;
        continue;
      }

      if (relPath.endsWith(".json")) {
        let content = readFileSync(srcPath, "utf-8");
        for (const [key, value] of Object.entries(templateVars)) {
          content = content.replaceAll(`{${key}}`, value);
        }
        writeFileSync(destPath, content);
      } else {
        copyFileSync(srcPath, destPath);
      }

      const displayPath = relative(this.targetDir, destPath);
      this.logger.success(`Created ${displayPath}`);
      created++;
    }

    return { created, skipped };
  }

  /**
   * Recursively walks a directory, yielding relative file paths.
   *
   * Returns paths sorted alphabetically for deterministic output.
   */
  private walkDir(dir: string, base = dir): string[] {
    const results: string[] = [];

    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        results.push(...this.walkDir(fullPath, base));
      } else {
        results.push(relative(base, fullPath));
      }
    }

    return results.sort();
  }
}
