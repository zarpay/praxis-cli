import type {
  ResolveProviderInput,
  ReviewProvider,
  ReviewProviderFactory,
  Service,
} from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { fileUrl, resolvePath } from "@/helpers/paths-helper.js";
import { OpenRouterProvider } from "@/providers/openrouter.js";

/** Built-in providers, keyed by the name used in a reviewer's `provider`. */
const BUILTIN_PROVIDERS: Record<string, ReviewProviderFactory> = {
  openrouter: () => new OpenRouterProvider(),
};

/**
 * Resolves a reviewer's `provider` value to a provider instance.
 *
 * A `./` or `../`-prefixed spec is a local ESM module, resolved against
 * the project root and dynamically imported; its default export must be
 * a factory returning a provider (see types.ts). Anything else is a
 * built-in registry name. No memoization: Node's ESM cache absorbs
 * repeat imports, and factories are cheap and stateless by contract.
 *
 * @throws PraxisError on unknown names, unloadable modules, or modules
 *   that do not implement the contract
 */
const resolveProviderService: Service<ResolveProviderInput, Promise<ReviewProvider>> = async (
  cfg,
  { spec },
) => {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return loadLocalProvider(spec, cfg.root);
  }

  const factory = BUILTIN_PROVIDERS[spec];

  if (!factory) {
    throw errors.unknownReviewProvider(spec, Object.keys(BUILTIN_PROVIDERS));
  }

  return factory();
};

export default resolveProviderService;

/** Imports a local provider module and validates it against the contract. */
async function loadLocalProvider(spec: string, root: string): Promise<ReviewProvider> {
  let module: { default?: unknown };

  try {
    module = (await import(fileUrl(resolvePath(root, spec)))) as { default?: unknown };
  } catch (err) {
    throw errors.reviewProviderLoadFailed(spec, (err as Error).message);
  }

  if (typeof module.default !== "function") {
    throw errors.invalidReviewProvider(spec, "default export is not a factory function");
  }

  const provider = (module.default as ReviewProviderFactory)();

  if (!provider || typeof provider.name !== "string") {
    throw errors.invalidReviewProvider(spec, "factory returned an object without a string name");
  }

  if (typeof provider.review !== "function") {
    throw errors.invalidReviewProvider(spec, "factory returned an object without a review()");
  }

  return provider;
}
