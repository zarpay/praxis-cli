import { CacheFile } from "@/domains/eval/models/cache-file.js";
import { exists, readText, removeFile } from "@/framework/files.js";

/**
 * Reads a target's cache file, or null when there is nothing usable.
 *
 * Absent, outdated and corrupt files all yield null. A corrupt file is
 * deleted when `discardCorrupt` is set, which the reviewing path wants
 * so the next write starts clean; the read-only reporting path leaves
 * it alone so nothing is destroyed by looking at it.
 *
 * Never raises. A cache that cannot be read costs an API call; a cache
 * that raised would cost the run.
 */
export default function readCacheFile({
  path,
  discardCorrupt = false,
}: {
  path: string;
  discardCorrupt?: boolean;
}): CacheFile | null {
  if (!exists(path)) return null;

  try {
    return CacheFile.parse(readText(path));
  } catch {
    if (discardCorrupt) removeQuietly(path);

    return null;
  }
}

/** Deletes a file, ignoring failures: cleanup must never mask the real problem. */
function removeQuietly(path: string): void {
  try {
    removeFile(path);
  } catch {
    /* the file being unreadable is already handled by returning null */
  }
}
