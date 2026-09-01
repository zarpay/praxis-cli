import type { ExpertFile } from "@/domains/spec/models/expert-file.js";
import type { AgentMetadata } from "@/domains/spec/types.js";

/**
 * Projects an expert onto the metadata its compiled outputs carry.
 *
 * Returns null when the expert declares no `description`: an agent
 * without one cannot be dispatched to, so emitting frontmatter for it
 * would produce a profile no host could route work to. The profile
 * body is still written — the expert is readable, just not addressable.
 */
export default function buildAgentMetadata(expert: ExpertFile): AgentMetadata | null {
  if (!expert.description) return null;

  return {
    name: expert.agentName,
    description: expert.description,
    cohort: expert.cohort,
    tools: expert.agentTools,
    model: expert.agentModel,
    excludes: expert.excludes,
    validates: expert.validates,
    exemplars: expert.exemplars,
    permissionMode: expert.agentPermissionMode,
  };
}
