import type { ReadVerdictInput, Verdict } from "@/types.js";

import readCacheFile from "@/services/read-cache-file-service.js";

/**
 * A reviewer's cached verdict for a (target, spec) pair, if still current.
 *
 * Null when the file is absent, this reviewer has no entry for the
 * spec, or the inputs have changed since the verdict was written — the
 * content hash covers target, spec and assist inputs, so any edit the
 * reviewer saw invalidates it.
 *
 * This is the reviewing path, so a corrupt file is discarded here: the
 * write that follows a miss should start from a clean file.
 */
export default function readVerdict({
  cache,
  targetPath,
  specPath,
  contentHash,
}: ReadVerdictInput): Verdict | null {
  const file = readCacheFile({ path: cache.pathFor(targetPath), discardCorrupt: true });

  if (!file) return null;

  const entry = file.entry(cache.keyFor(specPath));

  if (entry?.content_hash !== contentHash) return null;

  return entry.result;
}
