import type { CompileExpertInput, CompileExpertResult, Service } from "@/types.js";

import { readText } from "@/helpers/files-helper.js";
import { ExpertFile } from "@/models/expert-file.js";
import buildProfileService from "@/services/build-profile-service.js";
import inlineReferencesService from "@/services/inline-references-service.js";
import writeProfileOutputsService from "@/services/write-profile-outputs-service.js";

/**
 * Compiles one expert into its profile and every configured output.
 *
 * The workflow: read the expert, inline everything it references,
 * assemble the profile, and write it where config says. Each step is a
 * service; this only sequences them and collects what the author needs
 * to hear.
 *
 * @throws PraxisError when the file is not a valid expert document
 */
const compileExpertService: Service<CompileExpertInput, Promise<CompileExpertResult>> = async (
  config,
  { expertFile, plugins },
) => {
  const expert = ExpertFile.fromContent(readText(expertFile), expertFile);

  const inline = (patterns: string[], missingLabel: string) =>
    inlineReferencesService(config, { patterns, missingLabel });

  const [responsibilities, constitution, context, reference] = await Promise.all([
    inline(expert.refs("practices"), "Referenced file not found"),
    inline(expert.constitution, "Constitution file not found"),
    inline(expert.refs("context"), "Referenced file not found"),
    inline(expert.refs("refs"), "Referenced file not found"),
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

  const profile = buildProfileService(config, {
    role: expert.body(),
    responsibilities: responsibilities.bodies,
    constitution: constitution.bodies,
    context: context.bodies,
    reference: reference.bodies,
  });

  writeProfileOutputsService(config, {
    profile,
    metadata,
    alias: expert.alias,
    plugins,
  });

  return { alias: expert.alias, warnings };
};

export default compileExpertService;

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
