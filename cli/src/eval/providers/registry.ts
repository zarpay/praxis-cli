import type { JudgeProvider, JudgeProviderFactory } from "@/eval/providers/types.js";

import { errors } from "@/core/errors.js";
import { fileUrl, resolvePath } from "@/core/paths.js";
import { OpenRouterProvider } from "@/eval/providers/openrouter.js";

/** Built-in providers, keyed by the name used in a judge's `provider`. */
const BUILTIN_PROVIDERS: Record<string, JudgeProviderFactory> = {
  openrouter: () => new OpenRouterProvider(),
};

/**
 * Resolves a judge's `provider` value to a provider instance.
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
export async function resolveProvider(spec: string, root?: string): Promise<JudgeProvider> {
  if (spec.startsWith("./") || spec.startsWith("../")) {
    return loadLocalProvider(spec, root);
  }

  const factory = BUILTIN_PROVIDERS[spec];

  if (!factory) {
    throw errors.unknownJudgeProvider(spec, Object.keys(BUILTIN_PROVIDERS));
  }

  return factory();
}

/** Imports a local provider module and validates it against the contract. */
async function loadLocalProvider(spec: string, root?: string): Promise<JudgeProvider> {
  if (!root) {
    throw errors.judgeProviderLoadFailed(spec, "no project root to resolve the path against");
  }

  let module: { default?: unknown };

  try {
    module = (await import(fileUrl(resolvePath(root, spec)))) as { default?: unknown };
  } catch (err) {
    throw errors.judgeProviderLoadFailed(spec, (err as Error).message);
  }

  if (typeof module.default !== "function") {
    throw errors.invalidJudgeProvider(spec, "default export is not a factory function");
  }

  const provider = (module.default as JudgeProviderFactory)();

  if (!provider || typeof provider.name !== "string") {
    throw errors.invalidJudgeProvider(spec, "factory returned an object without a string name");
  }

  if (typeof provider.judge !== "function") {
    throw errors.invalidJudgeProvider(spec, "factory returned an object without a judge()");
  }

  return provider;
}
