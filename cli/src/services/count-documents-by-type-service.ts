import type { CountDocumentsInput, DocumentCounts } from "@/types.js";

import { resolvePath } from "@/helpers/paths-helper.js";
import { DocumentFile } from "@/models/document-file.js";
import listDocuments from "@/services/list-documents-service.js";

/**
 * Counts the reference and context documents across the source trees.
 *
 * Classification comes from each document's own `type:`. Conventions
 * and constitutions are both context — they differ in scope, not in
 * what they are to a reader — so they are counted together.
 *
 * Reads every document as a `DocumentFile` rather than a specific kind,
 * because a sweep cannot know in advance what each file is.
 */
export default async function countDocumentsByType({
  sources,
  root,
  specFilePattern,
  ignore,
}: CountDocumentsInput): Promise<DocumentCounts> {
  let references = 0;
  let context = 0;

  for (const source of sources) {
    const files = await listDocuments({
      dir: resolvePath(root, source),
      recursive: true,
      root,
      specFilePattern,
      ignore,
    });

    for (const file of files) {
      const type = DocumentFile.at(file).type;

      if (type === "reference") references++;
      else if (type === "convention" || type === "constitution") context++;
    }
  }

  return { references, context };
}
