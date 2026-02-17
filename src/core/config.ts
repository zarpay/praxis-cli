import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_FILE = join(".praxis", "config.json");

interface RawConfig {
  agentProfilesOutputDir?: string | false;
  plugins?: string[];
  sources?: string[];
  rolesDir?: string;
  responsibilitiesDir?: string;
  pluginsOutputDir?: string;
  pluginName?: string;
}

const DEFAULT_CONFIG: Required<RawConfig> = {
  agentProfilesOutputDir: "./agent-profiles",
  plugins: [],
  sources: ["roles", "responsibilities", "reference", "context"],
  rolesDir: "roles",
  responsibilitiesDir: "responsibilities",
  pluginsOutputDir: "./plugins",
  pluginName: "praxis",
};

/**
 * Loads and provides access to `.praxis/config.json` settings.
 *
 * Falls back to defaults when no config file exists, ensuring
 * backward compatibility with projects that predate the config file.
 */
export class PraxisConfig {
  private readonly root: string;
  private readonly data: Required<RawConfig>;

  constructor(root: string) {
    this.root = root;
    this.data = this.load();
  }

  /**
   * Absolute path for pure agent profile output, or null if disabled.
   *
   * When `agentProfilesOutputDir` is `false`, returns null (no profile output).
   * When it's a relative path string, resolves it against the project root.
   */
  get agentProfilesOutputDir(): string | null {
    const val = this.data.agentProfilesOutputDir;
    if (val === false) {
      return null;
    }
    return resolve(this.root, val);
  }

  /** Array of enabled plugin names (e.g. `["claude-code"]`). */
  get plugins(): string[] {
    return this.data.plugins;
  }

  /** Whether a specific plugin is enabled. */
  pluginEnabled(name: string): boolean {
    return this.data.plugins.includes(name);
  }

  /** Array of source directory paths (relative to root) for validation and watch. */
  get sources(): string[] {
    return this.data.sources;
  }

  /** Absolute path to the roles directory for compilation. */
  get rolesDir(): string {
    return resolve(this.root, this.data.rolesDir);
  }

  /** Absolute path to the responsibilities directory. */
  get responsibilitiesDir(): string {
    return resolve(this.root, this.data.responsibilitiesDir);
  }

  /** Absolute path to the plugins output directory. */
  get pluginsOutputDir(): string {
    return resolve(this.root, this.data.pluginsOutputDir);
  }

  /** Name used for the plugin subdirectory (e.g. "praxis" or "canon"). */
  get pluginName(): string {
    return this.data.pluginName;
  }

  private load(): Required<RawConfig> {
    const configPath = join(this.root, CONFIG_FILE);

    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as RawConfig;

    return {
      agentProfilesOutputDir: raw.agentProfilesOutputDir ?? DEFAULT_CONFIG.agentProfilesOutputDir,
      plugins: raw.plugins ?? DEFAULT_CONFIG.plugins,
      sources: raw.sources ?? DEFAULT_CONFIG.sources,
      rolesDir: raw.rolesDir ?? DEFAULT_CONFIG.rolesDir,
      responsibilitiesDir: raw.responsibilitiesDir ?? DEFAULT_CONFIG.responsibilitiesDir,
      pluginsOutputDir: raw.pluginsOutputDir ?? DEFAULT_CONFIG.pluginsOutputDir,
      pluginName: raw.pluginName ?? DEFAULT_CONFIG.pluginName,
    };
  }
}
