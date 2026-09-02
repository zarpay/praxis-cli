import type { DiscoveryScope } from "@/types.js";

import fg from "fast-glob";

import { isContentFile } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/models/praxis-config.js";

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
