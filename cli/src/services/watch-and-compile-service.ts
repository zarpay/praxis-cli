import type { FSWatcher } from "@/helpers/files-helper.js";
import type { WatchAndCompileInput } from "@/types.js";

import { watchDir } from "@/helpers/files-helper.js";
import { resolvePath } from "@/helpers/paths-helper.js";
import compileExpertsService from "@/services/compile-experts-service.js";

/**
 * Recompiles every expert whenever a source directory changes.
 *
 * Changes arrive in bursts — a save, a formatter, a branch switch — so
 * they are debounced into one recompile rather than one per file. A
 * failed recompile is reported and the watch continues: the next save
 * is the retry, and dropping the watcher would strand the author.
 *
 * @returns One watcher per source directory; callers that need to stop
 *   watching close them
 */
export default function watchAndCompile({
  sources,
  debounceMs = 300,
  onWatch,
  onRecompile,
  onError,
  ...compile
}: WatchAndCompileInput): FSWatcher[] {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return sources.map((source) => {
    const sourceDir = resolvePath(compile.root, source);

    onWatch?.(sourceDir);

    return watchDir(sourceDir, (filename) => {
      if (timer) clearTimeout(timer);

      timer = setTimeout(async () => {
        try {
          onRecompile?.(filename);
          await compileExpertsService(compile);
        } catch (err) {
          onError?.(err instanceof Error ? err.message : String(err));
        }
      }, debounceMs);
    });
  });
}
