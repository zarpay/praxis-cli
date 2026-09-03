import type { CountSpecUnitsInput } from "@/types.js";

import { joinPath, relativePath } from "@/helpers/paths-helper.js";
import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";

/**
 * Evaluated units per governing spec — the applicable-opportunity
 * denominator (07 rule 3, vocabulary): for an axiom, the units where it
 * could have been violated are its grounded spec's units.
 *
 * Runs stamp this onto their run records at write time; reports use it
 * for current-stock denominators. Keys are project-relative spec paths,
 * matching how critique records name their specs.
 */
export default function countSpecUnits({
  root,
  config,
}: CountSpecUnitsInput): Record<string, number> {
  const absoluteIgnore = config.ignore.map((pattern) => joinPath(root, pattern));
  const scope = {
    root,
    sources: config.sources,
    specFilePattern: config.specFilePattern,
    absoluteIgnore,
  };

  const counts: Record<string, number> = {};

  for (const domain of discoverDomainsService(scope)) {
    const units = resolveUnitsService({
      domain,
      specFilePattern: config.specFilePattern,
      absoluteIgnore,
    });

    counts[relativePath(root, domain.specPath)] = units.length;
  }

  return counts;
}
