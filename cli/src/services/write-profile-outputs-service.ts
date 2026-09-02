import type { WriteProfileOutputsInput } from "@/types.js";

import { writeText } from "@/helpers/files-helper.js";
import { joinPath } from "@/helpers/paths-helper.js";
import evalTargetingTemplate from "@/templates/eval-targeting-template.js";

/**
 * Writes a compiled profile everywhere it is configured to go.
 *
 * The pure profile, when a directory is configured, then each enabled
 * plugin's own output. The pure profile is the one the eval layer can
 * read as a spec, which is why it carries the targeting frontmatter:
 * `validates:` compiles through as `paths:` here.
 */
export default function writeProfileOutputs({
  profile,
  metadata,
  alias,
  agentProfilesOutputDir,
  plugins,
}: WriteProfileOutputsInput): void {
  if (agentProfilesOutputDir) {
    const targeting = metadata ? evalTargetingTemplate(metadata) : [];
    const content =
      targeting.length > 0 ? `---\n${targeting.join("\n")}\n---\n\n${profile}` : profile;

    writeText(joinPath(agentProfilesOutputDir, `${alias.toLowerCase()}.md`), content);
  }

  for (const plugin of plugins) {
    plugin.compile(profile, metadata, alias);
  }
}
