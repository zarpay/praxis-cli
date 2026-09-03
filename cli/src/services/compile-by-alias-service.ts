import type { CompileByAliasInput, CompileExpertResult } from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import compileExpertService from "@/services/compile-expert-service.js";
import { ExpertStore } from "@/stores/expert-store.js";

/**
 * Compiles the one expert declaring an alias.
 *
 * What `praxis compile --alias <name>` does: the author names the agent
 * they want rebuilt rather than the file it happens to live in.
 *
 * @throws PraxisError when no expert declares that alias, or the one
 *   that does is not a valid expert document
 */
export default async function compileByAlias({
  alias,
  expertsDir,
  ...scope
}: CompileByAliasInput): Promise<CompileExpertResult> {
  const store = new ExpertStore({ expertsDir, specFilePattern: scope.specFilePattern });
  const expert = store.byAlias(alias);

  if (!expert) {
    throw errors.expertNotFound(alias);
  }

  return compileExpertService({ ...scope, expertFile: expert.path });
}
