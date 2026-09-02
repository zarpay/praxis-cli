import type { DiscoveryScope } from "@/domains/eval/types.js";

import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/domains/workspace/models/praxis-config.js";
import { isContentFile } from "@/framework/files.js";
import { joinPath } from "@/framework/paths.js";

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
      .filter((file) => isContentFile(file, specFilePattern)),
  );

  return new Set(docs);
}
