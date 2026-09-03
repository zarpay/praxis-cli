import type { NoInput, Service } from "@/types.js";

import discoverDomainsService from "@/services/discover-domains-service.js";
import resolveUnitsService from "@/services/resolve-units-service.js";

/**
 * The path of every unit a run would review.
 *
 * What coverage is measured against: `praxis status` needs to know what
 * *would* be reviewed in order to say how much of it has a cached
 * verdict. It asks the eval layer rather than guessing, so the number
 * can never drift from what a run actually covers.
 */
const listTargetPathsService: Service<NoInput, string[]> = (config) => {
  const domains = discoverDomainsService(config, {});

  return domains.flatMap((domain) =>
    resolveUnitsService(config, { domain }).map((unit) => unit.path),
  );
};

export default listTargetPathsService;
