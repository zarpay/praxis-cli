import { errors } from "@/core/errors.js";
import { exists, readJson } from "@/core/files.js";
import { configFile, resolvePath } from "@/core/paths.js";

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

/** Validation configuration for the OpenRouter-based judge. */
export interface ValidationConfig {
  /** Name of the environment variable containing the API key. */
  apiKeyEnvVar: string;
  /** OpenRouter model identifier to use for validation. */
  model: string;
  /** Filename or glob pattern for spec files (default: "README.md"). */
  specFilePattern?: string;
}

/** Config shape as it may appear on disk (all fields optional). */
interface RawConfig {
  agentProfilesOutputDir?: string | false;
  plugins?: RawPluginEntry[];
  sources?: string[];
  ignore?: string[];
  expertsDir?: string;
  practicesDir?: string;
  /** Deprecated v1 name for expertsDir; accepted and normalized. */
  rolesDir?: string;
  /** Deprecated v1 name for practicesDir; accepted and normalized. */
  responsibilitiesDir?: string;
  validation?: ValidationConfig;
}

/** Config shape after defaults are applied. */
interface NormalizedConfig {
  agentProfilesOutputDir: string | false;
  plugins: PluginConfigEntry[];
  sources: string[];
  ignore: string[];
  expertsDir: string;
  practicesDir: string;
  validation?: ValidationConfig;
}

/** Defaults used when the config file is absent or fields are omitted. */
const DEFAULT_CONFIG: NormalizedConfig = {
  agentProfilesOutputDir: "./agent-profiles",
  plugins: [],
  // Legacy v1 directory names stay in the default scan list so projects
  // that predate the expert/practice rename keep working; missing
  // directories are skipped harmlessly everywhere.
  sources: ["experts", "practices", "roles", "responsibilities", "reference", "context"],
  ignore: [],
  expertsDir: "experts",
  practicesDir: "practices",
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

    return resolvePath(this.root, val);
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

  /** Project-root-relative glob patterns to exclude from all source scans. */
  get ignore(): string[] {
    return this.data.ignore;
  }

  /** Absolute path to the experts directory for compilation. */
  get expertsDir(): string {
    return resolvePath(this.root, this.data.expertsDir);
  }

  /** Absolute path to the practices directory. */
  get practicesDir(): string {
    return resolvePath(this.root, this.data.practicesDir);
  }

  /** Validation configuration, or undefined if not configured. */
  get validation(): ValidationConfig | undefined {
    return this.data.validation;
  }

  /**
   * Reads the config file and applies defaults for any missing fields.
   *
   * @throws Error naming the config path when the file contains invalid JSON
   */
  private load(): NormalizedConfig {
    const configPath = configFile(this.root);

    if (!exists(configPath)) {
      return { ...DEFAULT_CONFIG };
    }

    let raw: RawConfig;
    try {
      raw = readJson<RawConfig>(configPath);
    } catch (err) {
      throw errors.invalidConfigJson(configPath, (err as Error).message);
    }

    return {
      agentProfilesOutputDir: raw.agentProfilesOutputDir ?? DEFAULT_CONFIG.agentProfilesOutputDir,
      plugins: this.normalizePlugins(raw.plugins ?? []),
      sources: raw.sources ?? DEFAULT_CONFIG.sources,
      ignore: raw.ignore ?? DEFAULT_CONFIG.ignore,
      expertsDir: raw.expertsDir ?? raw.rolesDir ?? DEFAULT_CONFIG.expertsDir,
      practicesDir: raw.practicesDir ?? raw.responsibilitiesDir ?? DEFAULT_CONFIG.practicesDir,
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
