import picomatch from "picomatch";

import { baseName } from "@/core/paths.js";

/**
 * Checks whether a pattern contains any glob metacharacters.
 *
 * Covers wildcards (`*`, `?`), character classes (`[...]`),
 * brace expansion (`{a,b}`), and extglob groups (`(...)`).
 * Patterns without any of these are treated as literal filenames.
 */
export function hasGlobChars(pattern: string): boolean {
  return /[*?[\]{}()]/.test(pattern);
}

/**
 * Checks whether a file is a spec file under the configured pattern.
 *
 * Matches on the basename only, so both bare filenames and full paths
 * can be tested. Literal patterns (e.g. "README.md") use exact equality;
 * glob patterns (e.g. "*.sme.md") are matched via picomatch.
 *
 * @param filePathOrName - A filename or any path ending in one
 * @param pattern - The configured specFilePattern
 */
export function isSpecFile(filePathOrName: string, pattern: string): boolean {
  const name = baseName(filePathOrName);

  if (!hasGlobChars(pattern)) {
    return name === pattern;
  }

  return picomatch.isMatch(name, pattern);
}

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
