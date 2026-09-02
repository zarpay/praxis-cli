import type { CacheFileData, ReadVerdictEntryInput, VerdictEntry } from "@/eval/types.js";

import { CACHE_VERSION, CacheFile } from "@/eval/models/cache-file.js";
import readCacheFile from "@/eval/services/read-cache-file-service.js";

/**
 * One stored verdict, without checking whether it is still current.
 *
 * What `praxis eval verdict` and `praxis status` read: they report what
 * was recorded, staleness included, and make no API call. With no
 * `specPath` they take this reviewer's first entry, which is what a
 * single-spec target has.
 *
 * Read-only — a corrupt file is left alone rather than deleted, because
 * looking at a cache should never change it.
 */
export default function readVerdictEntry({
  cache,
  targetPath,
  specPath,
}: ReadVerdictEntryInput): CacheFileData | null {
  const file = readCacheFile({ path: cache.pathFor(targetPath) });

  if (!file) return null;

  const entries = file.entriesFor(cache.reviewer);
  const entry = specPath
    ? entries.find((candidate) => CacheFile.keyOf(candidate) === cache.keyFor(specPath))
    : entries[0];

  if (!entry) return null;

  return toCacheFileData(targetPath, entry);
}

/** The flattened per-verdict view report consumers read. */
function toCacheFileData(targetPath: string, entry: VerdictEntry): CacheFileData {
  return {
    version: CACHE_VERSION,
    cached_at: entry.cached_at,
    content_hash: entry.content_hash,
    document: { path: targetPath, spec_path: entry.spec_path },
    result: entry.result,
  };
}
