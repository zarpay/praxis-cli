import type { FSWatcher } from "@/helpers/files-helper.js";
import type { CompileExpertsInput, Service } from "@/types.js";

import { watchDir } from "@/helpers/files-helper.js";
import { resolvePath } from "@/helpers/paths-helper.js";
import compileExpertsService from "@/services/compile-experts-service.js";

/** A watch session over a project's source directories. */
interface WatchAndCompileInput extends CompileExpertsInput {
  /** How long to wait for a burst of changes to settle. */
  debounceMs?: number;
  /** Called once per directory as watching begins. */
  onWatch?: (sourceDir: string) => void;
  /** Called when a change triggers a recompile. */
  onRecompile?: (filename: string | null) => void;
  /** Called when a recompile fails; the watch continues regardless. */
  onError?: (message: string) => void;
}

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
const watchAndCompileService: Service<WatchAndCompileInput, FSWatcher[]> = (
  cfg,
  { debounceMs = 300, onWatch, onRecompile, onError, ...compile },
) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return cfg.sources.map((source) => {
    const sourceDir = resolvePath(cfg.root, source);

    onWatch?.(sourceDir);

    return watchDir(sourceDir, (filename) => {
      if (timer) clearTimeout(timer);

      timer = setTimeout(async () => {
        try {
          onRecompile?.(filename);
          await compileExpertsService(cfg, compile);
        } catch (err) {
          onError?.(err instanceof Error ? err.message : String(err));
        }
      }, debounceMs);
    });
  });
};

export default watchAndCompileService;
