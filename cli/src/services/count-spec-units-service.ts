import type { NoInput, Service } from "@/types.js";

import { relativePath } from "@/helpers/paths-helper.js";
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
const countSpecUnitsService: Service<NoInput, Record<string, number>> = (config) => {
  const counts: Record<string, number> = {};

  for (const domain of discoverDomainsService(config, {})) {
    const units = resolveUnitsService(config, { domain });

    counts[relativePath(config.root, domain.specPath)] = units.length;
  }

  return counts;
};

export default countSpecUnitsService;
