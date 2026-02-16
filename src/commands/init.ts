import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import type { Command } from "commander";

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
 * Scaffolds a new Praxis project by copying framework files,
 * placeholder content, and the Claude Code plugin structure
 * into the target directory.
 */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new Praxis project")
    .argument("[directory]", "target directory (defaults to current directory)", ".")
    .action(async (directory: string) => {
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
 * Copies all scaffold files into the target directory.
 *
 * Recursively walks the scaffold directory and copies each file
 * to the corresponding location in the target. Skips files that
 * already exist to avoid overwriting user content. Logs each
 * created file and prints next-steps guidance when complete.
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

  for (const relPath of walkDir(scaffoldDir)) {
    const srcPath = join(scaffoldDir, relPath);
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

  // Create empty agents directory for compile output
  const agentsDir = join(targetDir, "plugins", "praxis", "agents");
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }

  console.log();
  logger.info(`Initialized Praxis project: ${created} files created, ${skipped} skipped`);
  console.log();
  console.log("Next steps:");
  console.log("  1. Edit content/context/constitution/ to define your organization's identity");
  console.log("  2. Edit content/context/conventions/ to document your standards");
  console.log("  3. Run `praxis compile` to generate agent files");
  console.log("  4. Define new roles in content/roles/ as your organization grows");
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
