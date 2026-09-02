import type { ReviewProvider, ReviewProviderFactory } from "@/eval/types.js";

import { OpenRouterProvider } from "@/eval/providers/openrouter.js";
import { errors } from "@/framework/errors.js";
import { fileUrl, resolvePath } from "@/framework/paths.js";

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
export default async function resolveProvider(
  spec: string,
  root?: string,
): Promise<ReviewProvider> {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return loadLocalProvider(spec, root);
  }

  const factory = BUILTIN_PROVIDERS[spec];

  if (!factory) {
    throw errors.unknownReviewProvider(spec, Object.keys(BUILTIN_PROVIDERS));
  }

  return factory();
}

/** Imports a local provider module and validates it against the contract. */
async function loadLocalProvider(spec: string, root?: string): Promise<ReviewProvider> {
  if (!root) {
    throw errors.reviewProviderLoadFailed(spec, "no project root to resolve the path against");
  }

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
