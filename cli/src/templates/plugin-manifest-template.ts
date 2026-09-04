/** What the Claude Code plugin supplies to the manifest template. */
interface PluginManifestVars {
  /** The plugin's name in the manifest (`claudeCodePluginName`). */
  name: string;
}

/**
 * The `.claude-plugin/plugin.json` manifest the Claude Code plugin
 * installs when a project has none.
 *
 * Only the name comes from configuration (`claudeCodePluginName`); the
 * rest is a starting point the author edits in place. An existing
 * manifest is never replaced by this — the plugin only updates its name.
 */
export default function pluginManifestTemplate({ name }: PluginManifestVars): string {
  return `${JSON.stringify(
    {
      name,
      description: "A plugin for integrating assistant profiles with Claude.",
      author: { name: "Your Name" },
      keywords: ["productivity"],
    },
    null,
    2,
  )}\n`;
}
