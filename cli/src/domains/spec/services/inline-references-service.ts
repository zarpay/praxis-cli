import type { ExpandGlobsInput, InlineReferencesResult } from "@/domains/spec/types.js";

import expandGlobs from "@/domains/spec/services/expand-globs-service.js";
import { exists } from "@/framework/files.js";
import { MarkdownFile } from "@/framework/markdown-file.js";
import { joinPath } from "@/framework/paths.js";

/**
 * Resolves declared patterns and reads the body of every file they name.
 *
 * The compiler's inlining step: patterns in, prose out, in declaration
 * order. Problems come back as warnings rather than raising, because a
 * typo'd reference should not abandon the rest of a profile — but the
 * author still has to hear about it.
 *
 * The two failures are distinct on purpose. A glob matching nothing is
 * a pattern the author expected to hit something. A plain path that
 * does not exist is a reference to a file that isn't there.
 *
 * @param missingLabel - Prefix for the not-found warning, naming what
 *   kind of reference it was
 */
export default async function inlineReferences({
  patterns,
  root,
  specFilePattern,
  missingLabel,
}: ExpandGlobsInput & { missingLabel: string }): Promise<InlineReferencesResult> {
  const bodies: string[] = [];
  const warnings: string[] = [];

  const expansions = await expandGlobs({ patterns, root, specFilePattern });

  for (const { pattern, isGlob, matches } of expansions) {
    if (isGlob && matches.length === 0) {
      warnings.push(`Glob pattern matched zero files: ${pattern}`);
    }

    for (const relPath of matches) {
      const fullPath = joinPath(root, relPath);

      if (!exists(fullPath)) {
        warnings.push(`${missingLabel}: ${relPath}`);
        continue;
      }

      bodies.push(MarkdownFile.at(fullPath).body);
    }
  }

  return { bodies, warnings };
}
