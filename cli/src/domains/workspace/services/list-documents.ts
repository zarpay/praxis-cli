import type { ListDocumentsInput } from "@/domains/workspace/types.js";

import fg from "fast-glob";

import { exists } from "@/core/files.js";
import { baseName, resolvePath } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";

/**
 * The authored markdown documents in a directory.
 *
 * A spec file is direction, not an authored document, and an
 * underscore-prefixed file is a template — neither is ever listed. A
 * missing directory yields nothing rather than raising, because an
 * unused part of the taxonomy is a normal state, not an error.
 */
export default async function listDocuments({
  dir,
  recursive,
  root,
  specFilePattern,
  ignore = [],
}: ListDocumentsInput): Promise<string[]> {
  if (!exists(dir)) return [];

  const files = await fg(recursive ? "**/*.md" : "*.md", {
    cwd: dir,
    onlyFiles: true,
    absolute: true,
    ignore: ignore.map((pattern) => resolvePath(root, pattern)),
  });

  return files.filter((f) => !isSpecFile(f, specFilePattern) && !baseName(f).startsWith("_"));
}
