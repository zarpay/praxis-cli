import type { PraxisConfig } from "@/models/praxis-config.js";
import type {
  CompileExpertInput,
  CompileExpertResult,
  InlinedReferences,
  Service,
} from "@/types.js";

import { exists, readText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import { ExpertFile } from "@/models/expert-file.js";
import { MarkdownFile } from "@/models/markdown-file.js";
import buildProfileService from "@/services/build-profile-service.js";
import expandGlobsService from "@/services/expand-globs-service.js";
import writeProfileOutputsService from "@/services/write-profile-outputs-service.js";

/**
 * Compiles one expert into its profile and every configured output:
 * read the expert, inline everything it references, assemble the
 * profile, and write it where config says.
 *
 * Reference problems come back as warnings rather than raising,
 * because a typo'd reference should not abandon the rest of a profile
 * — but the author still has to hear about it. The two failures are
 * distinct on purpose: a glob matching nothing is a pattern the author
 * expected to hit something; a plain path that does not exist is a
 * reference to a file that isn't there.
 *
 * @throws PraxisError when the file is not a valid expert document
 */
const compileExpertService: Service<CompileExpertInput, Promise<CompileExpertResult>> = async (
  cfg,
  { expertFile, plugins },
) => {
  const expert = ExpertFile.fromContent(readText(expertFile), expertFile);

  const [responsibilities, constitution, context, reference] = await Promise.all([
    inline(cfg, expert.refs("practices"), "Referenced file not found"),
    inline(cfg, expert.constitution, "Constitution file not found"),
    inline(cfg, expert.refs("context"), "Referenced file not found"),
    inline(cfg, expert.refs("refs"), "Referenced file not found"),
  ]);

  const metadata = expert.agentMetadata();
  const warnings = [
    // An expert with no description compiles, but emits no agent
    // metadata — the profile is readable and not dispatchable.
    ...(metadata ? [] : ["No description found in role, skipping agent metadata"]),
    ...responsibilities.warnings,
    ...constitutionWarnings(expert.constitution, constitution.bodies),
    ...constitution.warnings,
    ...context.warnings,
    ...reference.warnings,
  ];

  const profile = buildProfileService(cfg, {
    role: expert.body(),
    responsibilities: responsibilities.bodies,
    constitution: constitution.bodies,
    context: context.bodies,
    reference: reference.bodies,
  });

  writeProfileOutputsService(cfg, {
    profile,
    metadata,
    alias: expert.alias,
    plugins,
  });

  return { alias: expert.alias, warnings };
};

export default compileExpertService;

/**
 * Resolves one reference key's patterns and reads the body of every
 * file they name — patterns in, prose out, in declaration order.
 *
 * @param missingLabel - Prefix for the not-found warning, naming what
 *   kind of reference it was
 */
async function inline(
  cfg: PraxisConfig,
  patterns: string[],
  missingLabel: string,
): Promise<InlinedReferences> {
  const bodies: string[] = [];
  const warnings: string[] = [];

  const expansions = await expandGlobsService(cfg, { patterns });

  for (const { pattern, isGlob, matches } of expansions) {
    if (isGlob && matches.length === 0) {
      warnings.push(`Glob pattern matched zero files: ${pattern}`);
    }

    for (const relPath of matches) {
      const fullPath = joinPath(cfg.root, relPath);

      if (!exists(fullPath)) {
        warnings.push(`${missingLabel}: ${relPath}`);
        continue;
      }

      bodies.push(MarkdownFile.fromContent(readText(fullPath), fullPath).body);
    }
  }

  return { bodies, warnings };
}

/**
 * The whole-key warning for a constitution that resolved to nothing.
 *
 * Distinct from the per-pattern warnings: an expert that declares a
 * constitution and ends up with no text has lost its identity section
 * entirely, which is worth saying once about the key rather than once
 * per pattern.
 */
function constitutionWarnings(declared: string[], bodies: string[]): string[] {
  if (declared.length === 0 || bodies.length > 0) return [];

  return ["Constitution patterns matched zero files"];
}
