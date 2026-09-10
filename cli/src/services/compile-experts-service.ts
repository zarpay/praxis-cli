import type { CompileExpertsInput, Service } from "@/types.js";

import { baseName } from "@/helpers/paths-helper.js";
import compileExpertService from "@/services/compile-expert-service.js";
import { ExpertStore } from "@/stores/expert-store.js";

/** What a full compile produced. */
interface CompileExpertsResult {
  /** How many experts compiled successfully. */
  compiled: number;
  /** Experts that could not be compiled, with the reason. */
  skipped: { file: string; reason: string }[];
}

/**
 * Compiles every expert in a directory.
 *
 * What counts as an expert — templates and spec files never do — is
 * `ExpertStore`'s listing rule, stated once there.
 *
 * A malformed expert is reported and skipped, never fatal: one bad file
 * must not abandon every other agent in the directory. Callers see each
 * outcome through `onProgress` as it happens, and the failures again in
 * the result.
 */
const compileExpertsService: Service<CompileExpertsInput, Promise<CompileExpertsResult>> = async (
  cfg,
  { plugins, onProgress },
) => {
  const store = new ExpertStore(cfg);
  const expertFiles = store.files();
  const skipped: CompileExpertsResult["skipped"] = [];
  let compiled = 0;

  for (const expertFile of expertFiles) {
    const name = baseName(expertFile);

    try {
      const result = await compileExpertService(cfg, { expertFile, plugins });

      for (const message of result.warnings) {
        onProgress?.({ kind: "warning", message });
      }

      onProgress?.({ kind: "compiled", alias: result.alias });
      compiled++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);

      skipped.push({ file: name, reason });
      onProgress?.({ kind: "skipped", file: name, reason });
    }
  }

  return { compiled, skipped };
};

export default compileExpertsService;
