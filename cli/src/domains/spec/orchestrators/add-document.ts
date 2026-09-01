import type { AddDocumentOptions } from "@/domains/spec/types.js";
import type { CommandContext } from "@/domains/workspace/models/command-context.js";

import { errors } from "@/core/errors.js";
import { exists, readText, writeText } from "@/core/files.js";
import { joinPath, relativePath } from "@/core/paths.js";
import { SCAFFOLD_DIR } from "@/domains/workspace/models/project-paths.js";
import { renderReport } from "@/views/report.js";

/**
 * Creates a new expert or practice from its template.
 *
 * What `praxis add` does: the taxonomy's entry point, so an author
 * starts from the shape the compiler expects rather than a blank file.
 *
 * Refuses to overwrite. An existing document is the author's work, and
 * `add` is not the command for editing it.
 *
 * @throws PraxisError when the target exists, or the template is missing
 */
export default async function addDocument(
  ctx: CommandContext,
  { type, name, scaffoldDir = SCAFFOLD_DIR }: AddDocumentOptions,
): Promise<void> {
  const { root, config } = ctx;
  const { expertsDir, practicesDir } = config;
  const isExpert = type === "expert";
  const templatePath = joinPath(
    scaffoldDir,
    "core",
    isExpert ? "experts" : "practices",
    "_template.md",
  );
  const targetFile = joinPath(isExpert ? expertsDir : practicesDir, `${name}.md`);
  const path = relativePath(root, targetFile);

  if (exists(targetFile)) {
    throw errors.fileAlreadyExists(path);
  }

  if (!exists(templatePath)) {
    throw errors.templateNotFound(templatePath);
  }

  writeText(targetFile, fillTemplate(type, name, readText(templatePath)));

  renderReport([{ channel: "success", text: `Created ${type}: ${path}` }], {
    out: ctx.out,
    logger: ctx.logger,
  });
}

/**
 * Fills the template's placeholders.
 *
 * An expert gets both its display name and the alias the compiler keys
 * it on; a practice gets only a title. The alias is the name as typed,
 * because it is an identifier, not prose.
 */
function fillTemplate(type: AddDocumentOptions["type"], name: string, template: string): string {
  const title = toTitleCase(name);

  if (type === "expert") {
    return template.replace(/\{expert_name\}/g, title).replace(/\{required_alias\}/g, name);
  }

  return template.replace(/\{practice_title\}/g, title);
}

/** Converts a kebab-case name to Title Case: "code-reviewer" → "Code Reviewer". */
function toTitleCase(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
