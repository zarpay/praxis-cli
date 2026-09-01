import type { ExpandGlobsInput, GlobExpansion } from "@/domains/spec/types.js";

import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { baseName } from "@/core/paths.js";
import { hasGlobChars, isSpecFile } from "@/core/spec-pattern.js";

/**
 * Resolves an expert's declared patterns to the files they match.
 *
 * A pattern with no wildcards is a plain path and matches only itself,
 * so an author can name one file or a set with the same key. Templates
 * and spec files are never matched: they are inputs to the compiler,
 * never content it inlines.
 *
 * Results come back per pattern rather than flattened, because both
 * callers need to know *which* pattern matched nothing — a glob that
 * hits nothing is a typo worth reporting, while a plain path that
 * matches nothing is a dangling reference. Flattening would throw away
 * the only thing that tells them apart.
 *
 * @returns One entry per input pattern, in declaration order
 */
export default async function expandGlobs({
  patterns,
  root,
  specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
}: ExpandGlobsInput): Promise<GlobExpansion[]> {
  return Promise.all(
    patterns.map(async (pattern) => {
      if (!hasGlobChars(pattern)) {
        return { pattern, isGlob: false, matches: [pattern] };
      }

      const matched = await fg(pattern, { cwd: root, onlyFiles: true });

      return {
        pattern,
        isGlob: true,
        matches: matched.filter((match) => !isExcluded(match, specFilePattern)).sort(),
      };
    }),
  );
}

/** Whether a matched path is a template or a spec, never inlined content. */
function isExcluded(filePath: string, specFilePattern: string): boolean {
  const name = baseName(filePath);

  return name === "_template.md" || isSpecFile(name, specFilePattern);
}
