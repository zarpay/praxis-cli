import { join, relative } from "node:path";

import type { Command } from "commander";

import { PraxisConfig } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { exists, readText, writeText } from "@/core/files.js";
import { Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";

/** Content types `praxis add` can create. */
export type AddableType = "role" | "responsibility";

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
  const add = program.command("add").description("Add new content from templates");

  add
    .command("role <name>")
    .description("Create a new role from template")
    .action((name: string) => {
      runAdd("role", name);
    });

  add
    .command("responsibility <name>")
    .description("Create a new responsibility from template")
    .action((name: string) => {
      runAdd("responsibility", name);
    });
}

/** Shared action body: build an AddCommand for the current project and run it. */
function runAdd(type: AddableType, name: string): void {
  const logger = new Logger();
  try {
    new AddCommand({ root: new Paths().root, logger }).add(type, name);
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/**
 * Creates new content files from the scaffold templates.
 *
 * Dependencies (project root, scaffold location, logger) are injected
 * at construction; each add() call reads the matching `_template.md`,
 * fills its placeholders, and writes the result into the content
 * directory the project config designates for that type.
 */
export class AddCommand {
  private readonly root: string;
  private readonly config: PraxisConfig;
  private readonly scaffoldDir: string;
  private readonly logger: Logger;

  constructor({
    root,
    scaffoldDir = SCAFFOLD_DIR,
    logger = new Logger(),
  }: {
    root: string;
    scaffoldDir?: string;
    logger?: Logger;
  }) {
    this.root = root;
    this.config = new PraxisConfig(root);
    this.scaffoldDir = scaffoldDir;
    this.logger = logger;
  }

  /**
   * Creates a new content file of the given type from its template.
   *
   * @param type - The content type to create
   * @param name - Kebab-case name for the new file (e.g. "code-reviewer")
   * @throws PraxisError if the target file already exists or the template is missing
   */
  add(type: AddableType, name: string): void {
    const subdir = type === "role" ? "roles" : "responsibilities";
    const targetDir = type === "role" ? this.config.rolesDir : this.config.responsibilitiesDir;
    const templatePath = join(this.scaffoldDir, "core", subdir, "_template.md");
    const targetFile = join(targetDir, `${name}.md`);
    const relTargetFile = relative(this.root, targetFile);

    if (exists(targetFile)) {
      throw errors.fileAlreadyExists(relTargetFile);
    }

    if (!exists(templatePath)) {
      throw errors.templateNotFound(templatePath);
    }

    const template = readText(templatePath);
    writeText(targetFile, this.fillTemplate(type, name, template));
    this.logger.success(`Created ${type}: ${relTargetFile}`);
  }

  /**
   * Fills template placeholders with the provided name.
   *
   * For roles: replaces `{role_name}` (Title Case) and `{required_alias}` (kebab-case).
   * For responsibilities: replaces `{verb_what_title}` (Title Case).
   */
  private fillTemplate(type: AddableType, name: string, template: string): string {
    const titleCase = this.toTitleCase(name);

    if (type === "role") {
      return template.replace(/\{role_name\}/g, titleCase).replace(/\{required_alias\}/g, name);
    }

    return template.replace(/\{verb_what_title\}/g, titleCase);
  }

  /**
   * Converts a kebab-case name to Title Case.
   *
   * @example toTitleCase("code-reviewer") // "Code Reviewer"
   */
  private toTitleCase(name: string): string {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
