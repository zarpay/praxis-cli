import type { AddDocumentInput, AddDocumentResult } from "@/domains/spec/types.js";

import { SCAFFOLD_DIR } from "@/domains/workspace/models/project-paths.js";
import { errors } from "@/framework/errors.js";
import { exists, readText, writeText } from "@/framework/files.js";
import { joinPath, relativePath } from "@/framework/paths.js";
import { kebabToTitleCase } from "@/framework/text.js";

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
  const title = kebabToTitleCase(name);

  let targetFile: string;
  let templatePath: string;
  let placeholders: [RegExp, string][];

  if (type === "expert") {
    templatePath = joinPath(scaffoldDir, "core", "experts", "_template.md");
    targetFile = joinPath(expertsDir, `${name}.md`);
    // An expert gets its display name and the alias the compiler keys it
    // on. The alias is the name as typed, because it is an identifier
    // rather than prose.
    placeholders = [
      [/\{expert_name\}/g, title],
      [/\{required_alias\}/g, name],
    ];
  } else if (type === "practice") {
    templatePath = joinPath(scaffoldDir, "core", "practices", "_template.md");
    targetFile = joinPath(practicesDir, `${name}.md`);
    placeholders = [[/\{practice_title\}/g, title]];
  } else {
    throw errors.invalidDocumentType(type);
  }

  const path = relativePath(root, targetFile);

  if (exists(targetFile)) {
    throw errors.fileAlreadyExists(path);
  }

  if (!exists(templatePath)) {
    throw errors.templateNotFound(templatePath);
  }

  const document = placeholders.reduce(
    (text, [placeholder, value]) => text.replace(placeholder, value),
    readText(templatePath),
  );

  writeText(targetFile, document);

  return { type, path };
}
