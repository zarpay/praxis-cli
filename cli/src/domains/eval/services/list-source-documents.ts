import type { DiscoveryScope } from "@/domains/eval/types.js";

import fg from "fast-glob";

import { joinPath } from "@/core/paths.js";
import { isJudgeable } from "@/core/spec-pattern.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/domains/workspace/models/praxis-config.js";

/**
 * Every .md document across the source directories.
 *
 * Includes documents in directories with no spec at all, which is what
 * makes this the denominator for a run's summary: a document no spec
 * covers is "not validated", not invisible.
 */
export default function listSourceDocuments({
  root,
  sources,
  specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
  absoluteIgnore = [],
}: DiscoveryScope): Set<string> {
  const docs = sources.flatMap((source) =>
    fg
      .sync("**/*.md", {
        cwd: joinPath(root, source),
        onlyFiles: true,
        absolute: true,
        dot: true,
        ignore: absoluteIgnore,
      })
      .filter((file) => isJudgeable(file, specFilePattern)),
  );

  return new Set(docs);
}
