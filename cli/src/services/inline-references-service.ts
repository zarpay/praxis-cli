import type { InlineReferencesInput, InlineReferencesResult, Service } from "@/types.js";

import { exists, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { MarkdownFile } from "@/models/markdown-file.js";
import expandGlobsService from "@/services/expand-globs-service.js";

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
 */
const inlineReferencesService: Service<
  InlineReferencesInput,
  Promise<InlineReferencesResult>
> = async (cfg, { patterns, missingLabel }) => {
  const bodies: string[] = [];
  const warnings: string[] = [];

  const expansions = await expandGlobsService(cfg, { patterns });

  for (const { pattern, isGlob, matches } of expansions) {
    if (isGlob && matches.length === 0) {
      warnings.push(`Glob pattern matched zero files: ${pattern}`);
    }

    for (const relPath of matches) {
      const fullPath = joinPath(cfg.root, relPath);

      if (!exists(fullPath)) {
        warnings.push(`${missingLabel}: ${relPath}`);
        continue;
      }

      bodies.push(MarkdownFile.fromContent(readText(fullPath), fullPath).body);
    }
  }

  return { bodies, warnings };
};

export default inlineReferencesService;
