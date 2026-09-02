import type { CompileByAliasInput, CompileExpertResult } from "@/spec/types.js";

import { errors } from "@/framework/errors.js";
import compileExpert from "@/spec/services/compile-expert-service.js";
import findExpertByAlias from "@/spec/services/find-expert-by-alias-service.js";

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
  const expertFile = await findExpertByAlias({ alias, expertsDir });

  if (!expertFile) {
    throw errors.expertNotFound(alias);
  }

  return compileExpert({ ...scope, expertFile });
}
