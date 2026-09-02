import type { CompileExpertsInput, CompileExpertsResult } from "@/spec/types.js";

import fg from "fast-glob";

import { matchesFilename } from "@/framework/files.js";
import { baseName } from "@/framework/paths.js";
import compileExpert from "@/spec/services/compile-expert-service.js";

/**
 * Compiles every expert in a directory.
 *
 * Templates (underscore-prefixed) and spec files are skipped — the same
 * rule the eval layer applies when collecting targets.
 *
 * A malformed expert is reported and skipped, never fatal: one bad file
 * must not abandon every other agent in the directory. Callers see each
 * outcome through `onProgress` as it happens, and the failures again in
 * the result.
 */
export default async function compileExperts({
  expertsDir,
  root,
  specFilePattern,
  agentProfilesOutputDir,
  plugins,
  onProgress,
}: CompileExpertsInput): Promise<CompileExpertsResult> {
  const expertFiles = await fg("*.md", { cwd: expertsDir, onlyFiles: true, absolute: true });
  const skipped: CompileExpertsResult["skipped"] = [];
  let compiled = 0;

  for (const expertFile of expertFiles) {
    const name = baseName(expertFile);

    if (name.startsWith("_") || matchesFilename(name, specFilePattern)) {
      continue;
    }

    try {
      const result = await compileExpert({
        expertFile,
        root,
        specFilePattern,
        agentProfilesOutputDir,
        plugins,
      });

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
}
