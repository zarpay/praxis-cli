import type { AddDocumentInput, AddDocumentResult } from "@/domains/spec/types.js";

import { SCAFFOLD_DIR } from "@/domains/workspace/models/project-paths.js";
import { errors } from "@/framework/errors.js";
import { exists, readText, writeText } from "@/framework/files.js";
import { joinPath, relativePath } from "@/framework/paths.js";

/**
 * Creates one expert or practice from its template.
 *
 * The taxonomy's entry point, so an author starts from the shape the
 * compiler expects rather than a blank file.
 *
 * Refuses to overwrite. An existing document is the author's work, and
 * `add` is not the command for editing it.
 *
 * @throws PraxisError when the target exists, or the template is missing
 */
export default function addDocumentService({
  type,
  name,
  root,
  expertsDir,
  practicesDir,
  scaffoldDir = SCAFFOLD_DIR,
}: AddDocumentInput): AddDocumentResult {
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

  return { type, path };
}

/**
 * Fills the template's placeholders.
 *
 * An expert gets both its display name and the alias the compiler keys
 * it on; a practice gets only a title. The alias is the name as typed,
 * because it is an identifier, not prose.
 */
function fillTemplate(type: AddDocumentInput["type"], name: string, template: string): string {
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
