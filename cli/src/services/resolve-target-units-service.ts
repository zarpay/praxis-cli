import type { EvalUnit, GovernedUnit, Service } from "@/types.js";

import { isAbsolute, joinPath, resolvePath } from "@/helpers/paths-helper.js";
import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";

/** The path a reader asked about. */
interface ResolveTargetUnitsInput {
  /** Absolute, or relative to the project root. */
  target: string;
}

/**
 * The review units covering a path.
 *
 * A reader names a file or a directory; the specs decide what the
 * reviewable thing actually is. `by_file` makes each file its own unit,
 * `by_directory` makes a whole directory one — so naming one member of
 * a cohort resolves to the cohort, because that is the unit the spec
 * judges and reviewing the member alone would answer a question the
 * spec never asks.
 *
 * An empty result means nothing governs the path: no spec's `paths:`
 * matches it, or a spec's `excludes:` shields it. The caller turns that
 * into the instructive error; this service only reports coverage.
 */
const resolveTargetUnitsService: Service<ResolveTargetUnitsInput, GovernedUnit[]> = (
  cfg,
  { target },
) => {
  const absolute = isAbsolute(target)
    ? resolvePath(target)
    : resolvePath(joinPath(cfg.root, target));
  const domains = discoverDomainsService(cfg, {});
  const covering: GovernedUnit[] = [];

  for (const domain of domains) {
    const units = resolveUnitsService(cfg, { domain });

    for (const unit of units) {
      if (covers(unit, absolute)) covering.push({ unit, domain });
    }
  }

  return covering;
};

export default resolveTargetUnitsService;

/**
 * Whether a unit answers for the path.
 *
 * True in both directions: the unit is the target or sits beneath it (a
 * named directory covering many units), or the target is one of the
 * unit's members (a named file inside a cohort).
 */
function covers(unit: EvalUnit, target: string): boolean {
  if (unit.path === target) return true;

  if (isBeneath(unit.path, target)) return true;

  return unit.files.some((file) => file === target || isBeneath(file, target));
}

/** Whether `path` sits inside the directory `parent`. */
function isBeneath(path: string, parent: string): boolean {
  return path.startsWith(`${parent}/`);
}
