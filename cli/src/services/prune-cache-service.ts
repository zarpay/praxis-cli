import type { PruneCacheInput, PruneCacheResult } from "@/types.js";

import {
  exists,
  listFilesRecursive,
  readText,
  removeFile,
  writeText,
} from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { CacheFile } from "@/models/cache-file.js";
import { Reviewer } from "@/models/reviewer.js";
import { VerdictStore } from "@/stores/verdict-store.js";

/**
 * Removes cached verdicts no configured reviewer can ever hit again.
 *
 * An entry is keyed by its reviewer's behavioral hash, so a config
 * change writes new keys and orphans the old ones — this is where they
 * finally go. An entry survives only if its hash belongs to a reviewer
 * configured right now; files of an unreadable or outdated format are
 * removed whole, and a file with nothing left is deleted rather than
 * kept as an empty husk.
 */
export default function pruneCacheService({ root, config }: PruneCacheInput): PruneCacheResult {
  const cacheRoot = new VerdictStore({ projectRoot: root }).root;
  const liveHashes = new Set(
    config.reviewers.map((reviewer) => Reviewer.fromConfig(reviewer).hash()),
  );

  let entriesPruned = 0;
  let filesRemoved = 0;

  if (!exists(cacheRoot)) {
    return { entriesPruned, filesRemoved };
  }

  for (const relPath of listFilesRecursive(cacheRoot)) {
    const path = joinPath(cacheRoot, relPath);
    const file = parseOrNull(readText(path));

    if (!file) {
      removeFile(path);
      filesRemoved++;
      continue;
    }

    entriesPruned += file.prune((entry) => liveHashes.has(entry.reviewer.hash));

    if (file.isEmpty()) {
      removeFile(path);
      filesRemoved++;
    } else {
      writeText(path, file.toJson());
    }
  }

  return { entriesPruned, filesRemoved };
}

/** A parsed cache file, or null for anything unreadable or outdated. */
function parseOrNull(json: string): CacheFile | null {
  try {
    return CacheFile.parse(json);
  } catch {
    return null;
  }
}
