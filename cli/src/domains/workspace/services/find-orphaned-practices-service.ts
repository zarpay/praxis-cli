import type { FindOrphanedPracticesInput } from "@/domains/workspace/types.js";

import { baseName, relativePath } from "@/framework/paths.js";

/**
 * Practices no expert references, by filename.
 *
 * An orphan is a practice that exists but nothing points at, which
 * means no compiled agent carries it — it is written but not in force.
 *
 * @param referenced - Project-relative paths some expert points at
 */
export default function findOrphanedPractices({
  practiceFiles,
  referenced,
  root,
}: FindOrphanedPracticesInput): string[] {
  return practiceFiles
    .filter((file) => !referenced.has(relativePath(root, file)))
    .map((file) => baseName(file));
}
