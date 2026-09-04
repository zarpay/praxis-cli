import type { Service } from "@/types.js";

import { copyFile, exists, listFilesRecursive } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";

/** A scaffold tree to copy into a project. */
interface CopyScaffoldInput {
  /** The scaffold subtree to copy from. */
  sourceDir: string;
  /** The project directory to copy into. */
  targetDir: string;
}

/** What one scaffold copy did. */
interface CopyScaffoldResult {
  /** Paths written, relative to the target. */
  created: string[];
  /** Files left alone because they already existed. */
  skipped: number;
}

/**
 * Copies a scaffold tree into a project, file for file.
 *
 * Anything already present is skipped, never overwritten — a scaffold
 * seeds a project, it does not maintain one — so the copy is safe to
 * re-run and reports exactly what it added.
 */
const copyScaffoldService: Service<CopyScaffoldInput, CopyScaffoldResult> = (
  _cfg,
  { sourceDir, targetDir },
) => {
  const created: string[] = [];
  let skipped = 0;

  for (const relPath of listFilesRecursive(sourceDir)) {
    const destPath = joinPath(targetDir, relPath);

    if (exists(destPath)) {
      skipped++;
      continue;
    }

    copyFile(joinPath(sourceDir, relPath), destPath);
    created.push(relPath);
  }

  return { created, skipped };
};

export default copyScaffoldService;
