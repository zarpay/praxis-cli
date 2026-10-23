import type { PraxisConfig } from "@/models/praxis-config.js";
import type { EvalUnit, Service, ValidationDomain } from "@/types.js";

import fg from "fast-glob";

/** The domain whose units to resolve. */
interface ResolveUnitsInput {
  domain: ValidationDomain;
}

/**
 * The review units a domain should review.
 *
 * `cohort: by_directory` yields one unit per matched directory holding
 * every member file — an empty directory yields no unit, because there
 * is nothing to review. `by_file` yields one unit per target file, from
 * `paths:` when declared, otherwise the spec's sibling .md files.
 */
const resolveUnitsService: Service<ResolveUnitsInput, EvalUnit[]> = (cfg, { domain }) => {
  const shielded = [...cfg.absoluteIgnore, ...domain.excludes];

  if (domain.cohort === "by_directory") {
    return (domain.targetDirs ?? [])
      .map((dir) => ({ path: dir, files: members(cfg, dir, shielded) }))
      .filter((unit) => unit.files.length > 0);
  }

  if (domain.targetFiles) {
    return domain.targetFiles.map((file) => ({ path: file, files: [file] }));
  }

  return targetsIn(cfg, "*.md", domain.dir, shielded).map((file) => ({
    path: file,
    files: [file],
  }));
};

export default resolveUnitsService;

/** A cohort directory's member files, sorted. */
function members(cfg: PraxisConfig, dir: string, shielded: string[]): string[] {
  return targetsIn(cfg, "**/*", dir, shielded).sort();
}

/** Files matching a pattern in a directory, minus specs and authoring templates. */
function targetsIn(cfg: PraxisConfig, pattern: string, cwd: string, ignore: string[]): string[] {
  return fg
    .sync(pattern, { cwd, onlyFiles: true, absolute: true, dot: true, ignore })
    .filter((file) => cfg.isTarget(file));
}
