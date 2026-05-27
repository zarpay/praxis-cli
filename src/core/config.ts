import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const CONFIG_FILE = join(".praxis", "config.json");

/** Normalized plugin configuration entry. */
export interface PluginConfigEntry {
  /** Plugin identifier (e.g. "claude-code"). */
  name: string;
  /** Full path to plugin output dir, resolved against project root. */
  outputDir?: string;
  /** Name used in the Claude Code plugin.json file. Default: "praxis". */
  claudeCodePluginName?: string;
}

/** Raw plugin entry as it appears in config JSON. */
export type RawPluginEntry = string | PluginConfigEntry;

/** Default spec file pattern when none is configured. */
export const DEFAULT_SPEC_FILE_PATTERN = "README.md";

/** Validation configuration for the OpenRouter-based document validator. */
export interface ValidationConfig {
  /** Name of the environment variable containing the API key. */
  apiKeyEnvVar: string;
  /** OpenRouter model identifier to use for validation. */
  model: string;
  /** Filename or glob pattern for spec files (default: "README.md"). */
  specFilePattern?: string;
}

interface RawConfig {
  agentProfilesOutputDir?: string | false;
  plugins?: RawPluginEntry[];
  sources?: string[];
  rolesDir?: string;
  responsibilitiesDir?: string;
  validation?: ValidationConfig;
}

interface NormalizedConfig {
  agentProfilesOutputDir: string | false;
  plugins: PluginConfigEntry[];
  sources: string[];
  rolesDir: string;
  responsibilitiesDir: string;
  validation?: ValidationConfig;
}

const DEFAULT_CONFIG: NormalizedConfig = {
  agentProfilesOutputDir: "./agent-profiles",
  plugins: [],
  sources: ["roles", "responsibilities", "reference", "context"],
  rolesDir: "roles",
  responsibilitiesDir: "responsibilities",
};

/**
 * Loads and provides access to `.praxis/config.json` settings.
 *
 * Falls back to defaults when no config file exists, ensuring
 * backward compatibility with projects that predate the config file.
 */
export class PraxisConfig {
  private readonly root: string;
  private readonly data: NormalizedConfig;

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

  /** Array of normalized plugin config entries. */
  get plugins(): PluginConfigEntry[] {
    return this.data.plugins;
  }

  /** Array of plugin name strings. */
  get pluginNames(): string[] {
    return this.data.plugins.map((p) => p.name);
  }

  /** Whether a specific plugin is enabled (by name). */
  pluginEnabled(name: string): boolean {
    return this.data.plugins.some((p) => p.name === name);
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

  /** Validation configuration, or undefined if not configured. */
  get validation(): ValidationConfig | undefined {
    return this.data.validation;
  }

  private load(): NormalizedConfig {
    const configPath = join(this.root, CONFIG_FILE);

    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as RawConfig;

    return {
      agentProfilesOutputDir: raw.agentProfilesOutputDir ?? DEFAULT_CONFIG.agentProfilesOutputDir,
      plugins: this.normalizePlugins(raw.plugins ?? []),
      sources: raw.sources ?? DEFAULT_CONFIG.sources,
      rolesDir: raw.rolesDir ?? DEFAULT_CONFIG.rolesDir,
      responsibilitiesDir: raw.responsibilitiesDir ?? DEFAULT_CONFIG.responsibilitiesDir,
      validation: raw.validation,
    };
  }

  /** Normalizes raw plugin entries: strings become `{ name: theString }`. */
  private normalizePlugins(raw: RawPluginEntry[]): PluginConfigEntry[] {
    return raw.map((entry) => {
      if (typeof entry === "string") {
        return { name: entry };
      }
      return entry;
    });
  }
}
