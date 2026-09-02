import type { DiscoveryScope } from "@/types.js";

import discoverDomains from "@/services/discover-domains-service.js";
import resolveUnits from "@/services/resolve-units-service.js";

/**
 * The path of every unit a run would review.
 *
 * What coverage is measured against: `praxis status` needs to know what
 * *would* be reviewed in order to say how much of it has a cached
 * verdict. It asks the eval layer rather than guessing, so the number
 * can never drift from what a run actually covers.
 */
export default function listTargetPaths(scope: DiscoveryScope): string[] {
  return discoverDomains(scope).flatMap((domain) =>
    resolveUnits({
      domain,
      specFilePattern: scope.specFilePattern,
      absoluteIgnore: scope.absoluteIgnore,
    }).map((unit) => unit.path),
  );
}
