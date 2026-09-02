import type { DiscoveryScope, ValidationDomain } from "@/domains/eval/types.js";

import fg from "fast-glob";

import { SpecFile } from "@/domains/eval/models/spec-file.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/domains/workspace/models/praxis-config.js";
import { isContentFile } from "@/framework/files.js";
import { baseName, joinPath, parentDir, relativePath } from "@/framework/paths.js";

/**
 * Every spec in the source directories, with what it governs.
 *
 * A spec's `paths:` expand against the project root into an explicit
 * target list; without them a spec governs its own directory's
 * siblings. Under `cohort: by_directory` the patterns match directories
 * instead of files, because the unit of review is the set.
 *
 * @throws PraxisError when a spec's frontmatter is malformed
 */
export default function discoverDomains({
  root,
  sources,
  specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
  absoluteIgnore = [],
}: DiscoveryScope): ValidationDomain[] {
  const domains: ValidationDomain[] = [];

  for (const source of sources) {
    const specPaths = fg.sync(`**/${specFilePattern}`, {
      cwd: joinPath(root, source),
      onlyFiles: true,
      absolute: true,
      dot: true,
    });

    for (const specPath of specPaths) {
      domains.push(domainFor(specPath, root, specFilePattern, absoluteIgnore));
    }
  }

  return domains;
}

/** One spec's domain: what it governs, and what is shielded from it. */
function domainFor(
  specPath: string,
  root: string,
  specFilePattern: string,
  absoluteIgnore: string[],
): ValidationDomain {
  const spec = SpecFile.at(specPath, root);
  const dir = parentDir(specPath);
  const excludes = spec.excludes.map((p) => joinPath(root, p));
  const exemplars = spec.exemplars.map((p) => joinPath(root, p));
  // Exemplars are shielded from adverse review exactly like excludes;
  // they reach the reviewer only as inlined positives.
  const ignore = [...absoluteIgnore, ...excludes, ...exemplars];

  const domain: ValidationDomain = {
    dir,
    type: relativePath(root, dir) || baseName(dir),
    specPath,
    excludes,
    exemplars,
    cohort: spec.cohort,
  };

  if (spec.cohort === "by_directory") {
    domain.targetDirs = fg
      .sync(spec.paths, { cwd: root, onlyDirectories: true, absolute: true, dot: true, ignore })
      .sort();
  } else if (spec.paths.length > 0) {
    domain.targetFiles = fg
      .sync(spec.paths, { cwd: root, onlyFiles: true, absolute: true, dot: true, ignore })
      .filter((file) => isContentFile(file, specFilePattern));
  }

  return domain;
}
