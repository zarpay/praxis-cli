import type { EvalUnit, ResolveUnitsInput, Service } from "@/types.js";

import fg from "fast-glob";

import { isContentFile } from "@/helpers/files-helper.js";

/**
 * The review units a domain should review.
 *
 * `cohort: by_directory` yields one unit per matched directory holding
 * every member file — an empty directory yields no unit, because there
 * is nothing to review. `by_file` yields one unit per target file, from
 * `paths:` when declared, otherwise the spec's sibling .md files.
 */
const resolveUnitsService: Service<ResolveUnitsInput, EvalUnit[]> = (config, { domain }) => {
  const specFilePattern = config.specFilePattern;
  const shielded = [...config.absoluteIgnore, ...domain.excludes, ...domain.exemplars];

  if (domain.cohort === "by_directory") {
    return (domain.targetDirs ?? [])
      .map((dir) => ({ path: dir, files: members(dir, shielded, specFilePattern) }))
      .filter((unit) => unit.files.length > 0);
  }

  if (domain.targetFiles) {
    return domain.targetFiles.map((file) => ({ path: file, files: [file] }));
  }

  return targetsIn("*.md", domain.dir, shielded, specFilePattern).map((file) => ({
    path: file,
    files: [file],
  }));
};

export default resolveUnitsService;

/** A cohort directory's member files, sorted. */
function members(dir: string, shielded: string[], specFilePattern: string): string[] {
  return targetsIn("**/*", dir, shielded, specFilePattern).sort();
}

/** Files matching a pattern in a directory, minus specs and templates. */
function targetsIn(
  pattern: string,
  cwd: string,
  ignore: string[],
  specFilePattern: string,
): string[] {
  return fg
    .sync(pattern, { cwd, onlyFiles: true, absolute: true, dot: true, ignore })
    .filter((file) => isContentFile(file, specFilePattern));
}
