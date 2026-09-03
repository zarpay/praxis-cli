import type {
  ProviderCompletion,
  ProviderRequest,
  RequestCuratorCompletionInput,
  Service,
} from "@/types.js";

import { PraxisError, errors } from "@/helpers/errors-helper.js";
import { Reviewer } from "@/models/reviewer.js";
import resolveProviderService from "@/services/resolve-provider-service.js";

/**
 * One structured-output call as the curator (04).
 *
 * The curator rides the reviewer plumbing — same defaults, same key
 * resolution, same provider selection, including `./relative` local
 * modules (the offline test seam) — but its calls are raw completions:
 * the curator's tools own their own shapes, so nothing here parses.
 *
 * @throws PraxisError without a curator, when the provider cannot
 *   complete(), or when it fails
 */
const requestCuratorCompletionService: Service<
  RequestCuratorCompletionInput,
  Promise<ProviderCompletion>
> = async (config, { systemPrompt, userPrompt, tools }) => {
  const curator = config.curator;

  if (!curator) throw errors.curatorNotConfigured();

  const identity = Reviewer.fromConfig({ name: "curator", ...curator });
  const provider = await resolveProviderService(config, { spec: identity.provider });

  if (!provider.complete) {
    throw errors.providerCannotComplete(provider.name);
  }

  const request: ProviderRequest = {
    systemPrompt,
    userPrompt,
    tools,
    model: identity.model,
    temperature: identity.temperature,
    baseUrl: identity.baseUrl,
    apiKey: identity.apiKey(),
    options: identity.options,
  };

  try {
    return await provider.complete(request);
  } catch (err) {
    if (err instanceof PraxisError) throw err;

    throw errors.reviewProviderFailed(provider.name, (err as Error).message);
  }
};

export default requestCuratorCompletionService;
