import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Command } from "commander";

import { Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";

/**
 * Resolved path to the scaffold directory shipped with the package.
 *
 * At runtime, `import.meta.dirname` resolves to `dist/` (the built output).
 * The scaffold directory sits one level up at the package root.
 */
const SCAFFOLD_DIR = join(import.meta.dirname, "..", "scaffold");

/**
 * Registers the `praxis add` command group.
 *
 * Provides subcommands for creating new roles and responsibilities
 * from templates with placeholders pre-filled.
 */
export function registerAddCommand(program: Command): void {
  const add = program
    .command("add")
    .description("Add new content from templates");

  add
    .command("role <name>")
    .description("Create a new role from template")
    .action((name: string) => {
      const logger = new Logger();
      try {
        addFromTemplate("role", name, logger);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  add
    .command("responsibility <name>")
    .description("Create a new responsibility from template")
    .action((name: string) => {
      const logger = new Logger();
      try {
        addFromTemplate("responsibility", name, logger);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Creates a new content file from a template with placeholders filled.
 *
 * Reads the appropriate `_template.md` from the scaffold directory,
 * replaces placeholder tokens with the provided name, and writes
 * the result to the correct content directory.
 *
 * @param type - The content type to create
 * @param name - Kebab-case name for the new file (e.g. "code-reviewer")
 * @param logger - Logger instance for output
 * @param options - Override root and scaffold paths (for testing)
 */
export function addFromTemplate(
  type: "role" | "responsibility",
  name: string,
  logger: Logger,
  options?: { root?: string; scaffoldDir?: string },
): void {
  const root = options?.root ?? new Paths().root;
  const scaffoldDir = options?.scaffoldDir ?? SCAFFOLD_DIR;

  const subdir = type === "role" ? "roles" : "responsibilities";
  const targetDir = join(root, "content", subdir);
  const templatePath = join(scaffoldDir, "core", "content", subdir, "_template.md");
  const targetFile = join(targetDir, `${name}.md`);

  if (existsSync(targetFile)) {
    throw new Error(`File already exists: content/${subdir}/${name}.md`);
  }

  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const template = readFileSync(templatePath, "utf-8");
  const filled = fillTemplate(type, name, template);

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  writeFileSync(targetFile, filled);
  logger.success(`Created ${type}: content/${subdir}/${name}.md`);
}

/**
 * Converts a kebab-case name to Title Case.
 *
 * @example toTitleCase("code-reviewer") // "Code Reviewer"
 */
function toTitleCase(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fills template placeholders with the provided name.
 *
 * For roles: replaces `{role_name}`, `{required_alias}`, `[Role Name]`, `[Alias]`
 * For responsibilities: replaces `{verb_what_title}`, `{owner_role_alias}`, `[Verb What]`
 */
function fillTemplate(type: "role" | "responsibility", name: string, template: string): string {
  const titleCase = toTitleCase(name);

  if (type === "role") {
    return template
      .replace(/\{role_name\}/g, titleCase)
      .replace(/\{required_alias\}/g, name)
      .replace(/\[Role Name\]/g, titleCase)
      .replace(/\[Alias\]/g, titleCase);
  }

  return template
    .replace(/\{verb_what_title\}/g, titleCase)
    .replace(/\[Verb What\]/g, titleCase);
}
