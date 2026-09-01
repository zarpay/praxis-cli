import { matchesFilename } from "@/core/files.js";
import { baseName } from "@/core/paths.js";

/**
 * Whether a path is a target of evaluation.
 *
 * Two rules apply to every scan the eval layer makes, which is why they
 * live in one place: a spec file is direction, never a target of it,
 * and an underscore-prefixed file is a template or scratch.
 */
export default function isTarget(file: string, specFilePattern: string): boolean {
  const name = baseName(file);

  return !matchesFilename(name, specFilePattern) && !name.startsWith("_");
}
