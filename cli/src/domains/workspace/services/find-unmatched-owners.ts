import type { FindUnmatchedOwnersInput, StatusReport } from "@/domains/workspace/types.js";

import { baseName } from "@/core/paths.js";
import { DocumentFile } from "@/domains/workspace/models/document-file.js";

/**
 * Practices whose `owner:` matches no expert alias.
 *
 * An owner naming nobody is usually a rename that did not propagate:
 * the practice still claims an accountable expert, but that expert no
 * longer exists under that alias.
 *
 * @param aliases - Lowercased alias to the expert file declaring it
 */
export default function findUnmatchedOwners({
  practiceFiles,
  aliases,
}: FindUnmatchedOwnersInput): StatusReport["unmatchedOwners"] {
  const unmatched: StatusReport["unmatchedOwners"] = [];

  for (const practiceFile of practiceFiles) {
    const owner = DocumentFile.at(practiceFile).owner;

    if (owner && !aliases.has(owner.toLowerCase())) {
      unmatched.push({ practice: baseName(practiceFile), owner });
    }
  }

  return unmatched;
}
