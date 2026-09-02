import type { AddDocumentInput, AddDocumentResult } from "@/spec/types.js";

import { errors } from "@/framework/errors.js";
import { exists, writeText } from "@/framework/files.js";
import { joinPath, relativePath } from "@/framework/paths.js";
import { kebabToTitleCase } from "@/framework/text.js";
import expertFileTemplate from "@/templates/expert-file-template.js";
import practiceFileTemplate from "@/templates/practice-file-template.js";

/**
 * Creates one expert or practice from its template.
 *
 * The taxonomy's entry point, so an author starts from the shape the
 * compiler expects rather than a blank file.
 *
 * Refuses to overwrite. An existing document is the author's work, and
 * `add` is not the command for editing it.
 *
 * @throws PraxisError when the type has no template, or the target exists
 */
export default function addDocumentService({
  type,
  name,
  root,
  expertsDir,
  practicesDir,
}: AddDocumentInput): AddDocumentResult {
  const title = kebabToTitleCase(name);

  let targetFile: string;
  let document: string;

  if (type === "expert") {
    targetFile = joinPath(expertsDir, `${name}.md`);
    document = expertFileTemplate({ title, alias: name });
  } else if (type === "practice") {
    targetFile = joinPath(practicesDir, `${name}.md`);
    document = practiceFileTemplate({ title });
  } else {
    throw errors.invalidDocumentType(type);
  }

  const path = relativePath(root, targetFile);

  if (exists(targetFile)) {
    throw errors.fileAlreadyExists(path);
  }

  writeText(targetFile, document);

  return { type, path };
}
