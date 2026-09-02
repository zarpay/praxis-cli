import type { DiscoveryScope } from "@/domains/eval/types.js";
import type { PraxisConfig } from "@/domains/workspace/models/praxis-config.js";

import { joinPath } from "@/framework/paths.js";

/**
 * The scope a full run covers, projected from the project's config.
 *
 * `ignore` is declared relative to the project root and resolved to
 * absolute here, because every consumer downstream compares absolute
 * paths.
 */
export default function buildReviewScopeService({
  root,
  config,
}: {
  root: string;
  config: PraxisConfig;
}): DiscoveryScope {
  return {
    root,
    sources: config.sources,
    specFilePattern: config.specFilePattern,
    absoluteIgnore: config.ignore.map((pattern) => joinPath(root, pattern)),
  };
}
