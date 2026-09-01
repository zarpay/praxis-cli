import type { Command } from "commander";

import type { Logger } from "@/core/logger.js";
import type { AddableType } from "@/types.js";

import { runAction } from "@/commands/action.js";
import { PraxisProjectBase } from "@/core/base.js";
import { errors } from "@/core/errors.js";
import { exists, readText, writeText } from "@/core/files.js";
import { Paths, SCAFFOLD_DIR, joinPath, relativePath } from "@/core/paths.js";

/**
 * Registers the `praxis add` command group.
 *
 * Provides subcommands for creating new roles and responsibilities
 * from templates with placeholders pre-filled.
 */
export function registerAddCommand(program: Command): void {
  const add = program.command("add").description("Add new content from templates");

  add
    .command("expert <name>")
    .description("Create a new expert from template")
    .action((name: string) => runAdd("expert", name));

  add
    .command("practice <name>")
    .description("Create a new practice from template")
    .action((name: string) => runAdd("practice", name));
}

/** Shared action body: build an AddCommand for the current project and run it. */
function runAdd(type: AddableType, name: string): Promise<void> {
  return runAction(() => new AddCommand({ root: new Paths().root }).add(type, name));
}

/**
 * Creates new content files from the scaffold templates.
 *
 * Dependencies (project root, scaffold location, logger) are injected
 * at construction; each add() call reads the matching `_template.md`,
 * fills its placeholders, and writes the result into the content
 * directory the project config designates for that type.
 */
export class AddCommand extends PraxisProjectBase {
  private readonly scaffoldDir: string;

  constructor({
    root,
    scaffoldDir = SCAFFOLD_DIR,
    logger,
  }: {
    root: string;
    scaffoldDir?: string;
    logger?: Logger;
  }) {
    super({ root, logger });
    this.scaffoldDir = scaffoldDir;
  }

  /**
   * Creates a new content file of the given type from its template.
   *
   * @param type - The content type to create
   * @param name - Kebab-case name for the new file (e.g. "code-reviewer")
   * @throws PraxisError if the target file already exists or the template is missing
   */
  add(type: AddableType, name: string): void {
    const subdir = type === "expert" ? "experts" : "practices";
    const targetDir = type === "expert" ? this.config.expertsDir : this.config.practicesDir;
    const templatePath = joinPath(this.scaffoldDir, "core", subdir, "_template.md");
    const targetFile = joinPath(targetDir, `${name}.md`);
    const relTargetFile = relativePath(this.root, targetFile);

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
   * For experts: replaces `{expert_name}` (Title Case) and `{required_alias}` (kebab-case).
   * For practices: replaces `{practice_title}` (Title Case).
   */
  private fillTemplate(type: AddableType, name: string, template: string): string {
    const titleCase = this.toTitleCase(name);

    if (type === "expert") {
      return template.replace(/\{expert_name\}/g, titleCase).replace(/\{required_alias\}/g, name);
    }

    return template.replace(/\{practice_title\}/g, titleCase);
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
