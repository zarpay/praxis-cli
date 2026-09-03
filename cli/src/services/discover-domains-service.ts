import type { PraxisConfig } from "@/models/praxis-config.js";
import type { NoInput, Service, ValidationDomain } from "@/types.js";

import fg from "fast-glob";

import { isContentFile } from "@/helpers/files-helper.js";
import { baseName, joinPath, parentDir, relativePath } from "@/helpers/paths-helper.js";
import { SpecStore } from "@/stores/spec-store.js";

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
const discoverDomainsService: Service<NoInput, ValidationDomain[]> = (config) => {
  const store = new SpecStore(config);

  return store.filesIn(config.sources).map((specPath) => domainFor(store, specPath, config));
};

export default discoverDomainsService;

/** One spec's domain: what it governs, and what is shielded from it. */
function domainFor(store: SpecStore, specPath: string, config: PraxisConfig): ValidationDomain {
  const root = config.root;
  const spec = store.read(specPath);
  const dir = parentDir(specPath);
  const excludes = spec.excludes.map((p) => joinPath(root, p));
  const exemplars = spec.exemplars.map((p) => joinPath(root, p));
  // Exemplars are shielded from adverse review exactly like excludes;
  // they reach the reviewer only as inlined positives.
  const ignore = [...config.absoluteIgnore, ...excludes, ...exemplars];

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
      .filter((file) => isContentFile(file, config.specFilePattern));
  }

  return domain;
}
