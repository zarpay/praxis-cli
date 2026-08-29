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
      const targetDir = resolve(directory);

      try {
        initProject(targetDir, logger);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Scaffolds a Praxis project into the target directory.
 *
 * 1. Copies all core scaffold files (content, config, README, etc.)
 * 2. Reads the scaffolded config to determine which plugins are enabled
 * 3. Copies plugin-specific scaffold files for each enabled plugin
 *
 * Skips files that already exist to avoid overwriting user content.
 *
 * @param targetDir - Absolute path to the project root
 * @param logger - Logger instance for output
 * @param scaffoldDir - Override scaffold source (for testing)
 */
export function initProject(targetDir: string, logger: Logger, scaffoldDir = SCAFFOLD_DIR): void {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  let created = 0;
  let skipped = 0;

  // Step 1: Copy core scaffold files
  const coreDir = join(scaffoldDir, "core");
  const coreResult = copyScaffoldDir(coreDir, targetDir, logger);
  created += coreResult.created;
  skipped += coreResult.skipped;

  // Step 2: Read config to determine which plugins to scaffold
  const config = new PraxisConfig(targetDir);

  // Step 3: Copy plugin scaffold files for each enabled plugin
  for (const pluginEntry of config.plugins) {
    const pluginScaffoldDir = join(scaffoldDir, "plugins", pluginEntry.name);
    if (!existsSync(pluginScaffoldDir)) {
      continue;
    }

    // Resolve the plugin output directory within the target
    const pluginOutputDir = pluginEntry.outputDir
      ? resolve(targetDir, pluginEntry.outputDir)
      : join(targetDir, "plugins", "praxis");

    const templateVars: Record<string, string> = {
      claudeCodePluginName: pluginEntry.claudeCodePluginName ?? "praxis",
    };

    const pluginResult = copyPluginScaffold(
      pluginScaffoldDir,
      pluginOutputDir,
      templateVars,
      logger,
      targetDir,
    );
    created += pluginResult.created;
    skipped += pluginResult.skipped;
  }

  console.log();
  logger.info(`Initialized Praxis project: ${created} files created, ${skipped} skipped`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Edit context/constitution/ to define your organization's identity");
  console.log("  2. Edit context/conventions/ to document your standards");
  console.log("  3. Run `praxis compile` to generate agent files");
  console.log("  4. Define new roles in roles/ as your organization grows");
}

/**
 * Copies all files from a scaffold source directory into a target directory.
 *
 * @returns Count of files created and skipped
 */
function copyScaffoldDir(
  sourceDir: string,
  targetDir: string,
  logger: Logger,
): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;

  for (const relPath of walkDir(sourceDir)) {
    const srcPath = join(sourceDir, relPath);
    const destPath = join(targetDir, relPath);
    const destDir = dirname(destPath);

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    if (existsSync(destPath)) {
      skipped++;
      continue;
    }

    copyFileSync(srcPath, destPath);
    logger.success(`Created ${relPath}`);
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
 * @param logger - Logger instance
 * @param projectRoot - Project root for relative path display
 * @returns Count of files created and skipped
 */
function copyPluginScaffold(
  sourceDir: string,
  targetPluginDir: string,
  templateVars: Record<string, string>,
  logger: Logger,
  projectRoot: string,
): { created: number; skipped: number } {
  let created = 0;
  let skipped = 0;

  for (const relPath of walkDir(sourceDir)) {
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

    const displayPath = relative(projectRoot, destPath);
    logger.success(`Created ${displayPath}`);
    created++;
  }

  return { created, skipped };
}

/**
 * Recursively walks a directory, yielding relative file paths.
 *
 * Returns paths sorted alphabetically for deterministic output.
 */
function walkDir(dir: string, base = dir): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, base));
    } else {
      results.push(relative(base, fullPath));
    }
  }

  return results.sort();
}
