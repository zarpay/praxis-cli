import type { PraxisConfig } from "@/models/praxis-config.js";
import type { DiffTarget, ResolveDiffInput, ResolveDiffResult, Service } from "@/types.js";

import picomatch from "picomatch";

import { errors } from "@/helpers/errors-helper.js";
import { matchesFilename } from "@/helpers/files-helper.js";
import {
  changedFilesOfRange,
  defaultBranchRef,
  mergeBase,
  resolveSha,
} from "@/helpers/git-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";
import { SpecStore } from "@/stores/spec-store.js";

/**
 * Resolves what a `--diff` run measures (12): the merge-base against
 * the named (or detected) base ref, the files the range changed, and
 * the coverage split. Git mechanics only; nothing here reviews.
 *
 * Coverage means "would a corpus run review it": a changed file is a
 * target exactly when it is a by-file unit of some discovered domain,
 * which honors `paths:` targeting, `excludes:`, `exemplars:`, and the
 * config's `ignore` the same way every run does. The remainder is
 * recorded so the report can say how much work was invisible (01).
 * Files governed only by a `by_directory` cohort spec count as
 * uncovered for now — per-file diffing of a cohort standard would
 * measure a question the spec never asked (cohort diff units are
 * deferred with the scope itself).
 *
 * Spec files and `.praxis/` are never targets or coverage gaps — a
 * changed spec is provenance for the review, not a unit of it.
 *
 * @throws PraxisError outside a git repo, when no base can be detected,
 *   or when the base shares no history with HEAD
 */
const resolveDiffService: Service<ResolveDiffInput, ResolveDiffResult> = (cfg, { base }) => {
  const headSha = resolveSha(cfg.root, "HEAD");

  if (headSha === null) throw errors.diffOutsideGit();

  const baseRef = base ?? defaultBranchRef(cfg.root);

  if (baseRef === null) throw errors.diffBaseUnresolvable();

  const baseSha = mergeBase(cfg.root, baseRef);

  if (baseSha === null) throw errors.diffBaseInvalid(baseRef);

  const specByUnitPath = unitCoverage(cfg);
  const targets: DiffTarget[] = [];
  const uncovered: string[] = [];

  // Ignored files are never evaluated and never counted (config), so
  // they are neither targets nor coverage gaps — same for .praxis/ and
  // spec files, which are provenance for the review, not units of it.
  const ignored = picomatch(cfg.ignore, { dot: true });
  const changed = changedFilesOfRange(cfg.root, baseSha).filter(
    ({ path }) =>
      !path.startsWith(".praxis/") && !ignored(path) && !matchesFilename(path, cfg.specFilePattern),
  );

  const specStore = new SpecStore(cfg);

  for (const { path: relPath, status } of changed) {
    const path = joinPath(cfg.root, relPath);
    // A deleted file cannot appear in the current tree's units; its
    // sibling spec still governs what its resolutions count against.
    // (A paths:-targeted deletion stays invisible — accepted, 12.)
    const specPath =
      status === "deleted"
        ? governingPathOrNull(specStore, path)
        : (specByUnitPath.get(path) ?? null);

    if (specPath === null) {
      uncovered.push(relPath);
      continue;
    }

    targets.push({ path, relPath, specPath, status });
  }

  return { baseRef, baseSha, headSha, targets, uncovered };
};

export default resolveDiffService;

/** Every by-file unit's governing spec, keyed by absolute unit path. */
function unitCoverage(cfg: PraxisConfig): Map<string, string> {
  const coverage = new Map<string, string>();

  for (const domain of discoverDomainsService(cfg, {})) {
    if (domain.cohort !== "by_file") continue;

    for (const unit of resolveUnitsService(cfg, { domain })) {
      coverage.set(unit.path, domain.specPath);
    }
  }

  return coverage;
}

/** The sibling spec that would govern a path, or null when none does. */
function governingPathOrNull(store: SpecStore, path: string): string | null {
  try {
    return store.governingPath(path);
  } catch {
    return null;
  }
}
