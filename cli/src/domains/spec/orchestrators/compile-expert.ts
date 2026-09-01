import type { CompileExpertInput, CompileExpertResult } from "@/domains/spec/types.js";

import { ExpertFile } from "@/domains/spec/models/expert-file.js";
import buildAgentMetadata from "@/domains/spec/services/build-agent-metadata.js";
import buildProfile from "@/domains/spec/services/build-profile.js";
import inlineReferences from "@/domains/spec/services/inline-references.js";
import writeProfileOutputs from "@/domains/spec/services/write-profile-outputs.js";

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
export default async function compileExpert({
  expertFile,
  root,
  specFilePattern,
  agentProfilesOutputDir,
  plugins,
}: CompileExpertInput): Promise<CompileExpertResult> {
  const expert = ExpertFile.at(expertFile);

  const inline = (patterns: string[], missingLabel: string) =>
    inlineReferences({ patterns, root, specFilePattern, missingLabel });

  const [responsibilities, constitution, context, reference] = await Promise.all([
    inline(expert.refs("practices"), "Referenced file not found"),
    inline(expert.constitution, "Constitution file not found"),
    inline(expert.refs("context"), "Referenced file not found"),
    inline(expert.refs("refs"), "Referenced file not found"),
  ]);

  const metadata = buildAgentMetadata(expert);
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

  const profile = buildProfile({
    role: expert.body(),
    responsibilities: responsibilities.bodies,
    constitution: constitution.bodies,
    context: context.bodies,
    reference: reference.bodies,
  });

  writeProfileOutputs({
    profile,
    metadata,
    alias: expert.alias,
    agentProfilesOutputDir,
    plugins,
  });

  return { alias: expert.alias, warnings };
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
