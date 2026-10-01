import type { AgentMetadata, CompilerPlugin, Service } from "@/types.js";

import { writeText } from "@/helpers/files-helper.js";
import { joinPath, relativePath } from "@/helpers/paths-helper.js";
import evalTargetingTemplate from "@/templates/eval-targeting-template.js";

/**
 * One compiled profile and where it should go.
 *
 * `agentProfilesOutputDir` is already resolved: null means no profile
 * output. The raw config spells that `false`; `PraxisConfig` resolves
 * it, and nothing past that boundary should see the other spelling.
 */
interface WriteProfileOutputsInput {
  /** The assembled profile markdown. */
  profile: string;
  /** Agent metadata, or null when the expert declares no description. */
  metadata: AgentMetadata | null;
  /** The expert's alias, which names the output file. */
  alias: string;
  /** The enabled output plugins, already constructed. */
  plugins: CompilerPlugin[];
}

/**
 * Writes a compiled profile everywhere it is configured to go, and
 * returns the pure profile's root-relative path — or null when no
 * profile directory is configured and only plugins wrote anything.
 *
 * The pure profile, when a directory is configured, then each enabled
 * plugin's own output. The pure profile is the one the eval layer can
 * read as a spec, which is why it carries the targeting frontmatter:
 * `validates:` compiles through as `paths:` here. The path comes back
 * so the compile output can name the file that was written rather than
 * guess at it from the alias.
 */
const writeProfileOutputsService: Service<WriteProfileOutputsInput, string | null> = (
  cfg,
  { profile, metadata, alias, plugins },
) => {
  const agentProfilesOutputDir = cfg.agentProfilesOutputDir;
  let output: string | null = null;

  if (agentProfilesOutputDir) {
    const targeting = metadata ? evalTargetingTemplate(metadata) : [];
    const content =
      targeting.length > 0 ? `---\n${targeting.join("\n")}\n---\n\n${profile}` : profile;
    const path = joinPath(agentProfilesOutputDir, profileFilename(alias));

    writeText(path, content);
    output = relativePath(cfg.root, path);
  }

  for (const plugin of plugins) {
    plugin.compile(profile, metadata, alias);
  }

  return output;
};

/** The profile suffix every compiled expert carries. */
const PROFILE_SUFFIX = ".expert";

/**
 * The profile's filename: the lowercased alias with `.expert.md`.
 *
 * An alias that already ends in `.expert` (a project naming its
 * experts by their role in the filename, `guards.expert`) gets the
 * suffix once — `guards.expert.md`, never `guards.expert.expert.md`.
 */
export function profileFilename(alias: string): string {
  const base = alias.toLowerCase();
  const stem = base.endsWith(PROFILE_SUFFIX) ? base.slice(0, -PROFILE_SUFFIX.length) : base;

  return `${stem}${PROFILE_SUFFIX}.md`;
}

export default writeProfileOutputsService;
