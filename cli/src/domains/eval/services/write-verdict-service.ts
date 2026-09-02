import type { VerdictEntry, WriteVerdictInput } from "@/domains/eval/types.js";

import { CacheFile } from "@/domains/eval/models/cache-file.js";
import readCacheFile from "@/domains/eval/services/read-cache-file-service.js";
import { exists, removeFile, writeText } from "@/framework/files.js";

/**
 * Stores a reviewer's verdict for a (target, spec) pair.
 *
 * Every other spec's and reviewer's entries in the file are preserved —
 * one file holds a target's complete review state, so a write must be
 * an upsert, never a replace.
 *
 * Silently fails on I/O trouble, discarding a file it could not write
 * rather than leaving a half-written one: a verdict that cannot be
 * cached is still a verdict, and the next run just pays for it again.
 */
export default function writeVerdict({
  cache,
  targetPath,
  specPath,
  contentHash,
  result,
  exemplarFiles,
  contextFiles,
}: WriteVerdictInput): void {
  const path = cache.pathFor(targetPath);
  const file = readCacheFile({ path }) ?? CacheFile.empty();

  const entry: VerdictEntry = {
    reviewer: cache.reviewer,
    spec_path: cache.relativeToRoot(specPath),
    cached_at: new Date().toISOString(),
    content_hash: contentHash,
    result: {
      ...result,
      reason: sanitizeText(result.reason),
      issues: result.issues.map(sanitizeText),
    },
    ...(exemplarFiles?.length ? { exemplar_files: exemplarFiles } : {}),
    ...(contextFiles?.length ? { context_files: contextFiles } : {}),
  };

  file.put(cache.keyFor(specPath), entry);

  try {
    writeText(path, file.toJson());
  } catch {
    removeQuietly(path);
  }
}

/** Deletes a half-written file, ignoring failures. */
function removeQuietly(path: string): void {
  try {
    if (exists(path)) removeFile(path);
  } catch {
    /* nothing further to do: the verdict is already returned to the caller */
  }
}

/**
 * Strips control characters and double quotes to keep stored JSON well
 * formed. Preserves newlines, carriage returns, and tabs.
 */
function sanitizeText(text: string): string {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/"/g, "'");
}
