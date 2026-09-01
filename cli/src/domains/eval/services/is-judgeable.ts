import { baseName } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";

/**
 * Whether a path is a judgeable target.
 *
 * Two rules apply to every scan the eval layer makes, which is why they
 * live in one place: a spec file is direction, never a target of it,
 * and an underscore-prefixed file is a template or scratch.
 */
export function isJudgeable(file: string, specFilePattern: string): boolean {
  const name = baseName(file);

  return !isSpecFile(name, specFilePattern) && !name.startsWith("_");
}
