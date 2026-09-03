import type {
  CuratorConfig,
  DiscoveryScope,
  ReviewerConfig,
  NormalizedConfig,
  PluginConfigEntry,
  RawConfig,
  RawPluginEntry,
} from "@/types.js";

import { errors } from "@/helpers/errors-helper.js";
import { exists, readJson } from "@/helpers/files-helper.js";
import { resolvePath } from "@/helpers/paths-helper.js";
import { configFile } from "@/models/project-paths.js";

/** Default spec file pattern when none is configured. */
export const DEFAULT_SPEC_FILE_PATTERN = "README.md";

/** Default inference endpoint when a reviewer declares no baseUrl. */
export const DEFAULT_REVIEWER_BASE_URL = "https://openrouter.ai/api/v1";

/** Provider used when a reviewer declares none. */
export const DEFAULT_REVIEWER_PROVIDER = "openrouter";

/** Default sampling temperature when a reviewer declares none. */
export const DEFAULT_REVIEWER_TEMPERATURE = 0.0;

/** Defaults used when the config file is absent or fields are omitted. */
const DEFAULT_CONFIG: NormalizedConfig = {
  agentProfilesOutputDir: "./agent-profiles",
  plugins: [],
  sources: ["experts", "practices", "reference", "context"],
  ignore: [],
  expertsDir: "experts",
  practicesDir: "practices",
  reviewers: [],
  curator: null,
  specFilePattern: DEFAULT_SPEC_FILE_PATTERN,
};

/**
 * Loads and provides access to `.praxis/config.json` settings.
 *
 * Falls back to defaults when no config file exists, ensuring
 * backward compatibility with projects that predate the config file.
 */
export class PraxisConfig {
  /** The project root every relative field resolves against. */
  readonly root: string;

  private readonly data: NormalizedConfig;

  constructor(root: string, raw?: RawConfig) {
    this.root = root;
    this.data = raw === undefined ? this.load() : this.normalize(raw);
  }

  /**
   * A config assembled from raw fields rather than read from disk —
   * the seam a test uses to override one value without writing a
   * config file, with the same defaults and validation as a real read.
   */
  static inMemory(root: string, raw: RawConfig = {}): PraxisConfig {
    return new PraxisConfig(root, raw);
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

  /** The ignore patterns resolved absolute — what path comparisons use. */
  get absoluteIgnore(): string[] {
    return this.data.ignore.map((pattern) => resolvePath(this.root, pattern));
  }

  /** Absolute path to the experts directory for compilation. */
  get expertsDir(): string {
    return resolvePath(this.root, this.data.expertsDir);
  }

  /** Absolute path to the practices directory. */
  get practicesDir(): string {
    return resolvePath(this.root, this.data.practicesDir);
  }

  /** The configured reviewers; empty when none are configured. */
  get reviewers(): ReviewerConfig[] {
    return this.data.reviewers;
  }

  /**
   * The curator — the taxonomy's librarian (04) — or null when the
   * project has not chosen one. Callers that need it raise the
   * instructive error rather than falling back to a reviewer: taxonomy
   * work silently done by a cheap model is the failure mode the role
   * exists to prevent.
   */
  get curator(): CuratorConfig | null {
    return this.data.curator;
  }

  /** The spec file pattern (default: "README.md"). */
  get specFilePattern(): string {
    return this.data.specFilePattern;
  }

  /**
   * The scope a full run covers, projected from this config.
   *
   * `ignore` is declared relative to the project root and resolved to
   * absolute here, because every consumer downstream compares absolute
   * paths.
   */
  discoveryScope(): DiscoveryScope {
    return {
      root: this.root,
      sources: this.sources,
      specFilePattern: this.specFilePattern,
      absoluteIgnore: this.absoluteIgnore,
    };
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

    return this.normalize(raw);
  }

  /**
   * Applies defaults and validation to raw config fields.
   *
   * @throws PraxisError on invalid reviewer or curator declarations
   */
  private normalize(raw: RawConfig): NormalizedConfig {
    return {
      agentProfilesOutputDir: raw.agentProfilesOutputDir ?? DEFAULT_CONFIG.agentProfilesOutputDir,
      plugins: this.normalizePlugins(raw.plugins ?? []),
      sources: raw.sources ?? DEFAULT_CONFIG.sources,
      ignore: raw.ignore ?? DEFAULT_CONFIG.ignore,
      expertsDir: raw.expertsDir ?? DEFAULT_CONFIG.expertsDir,
      practicesDir: raw.practicesDir ?? DEFAULT_CONFIG.practicesDir,
      reviewers: this.normalizeReviewers(raw),
      curator: this.normalizeCurator(raw),
      specFilePattern: raw.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN,
    };
  }

  /**
   * Validates and normalizes the reviewers array.
   *
   * @throws PraxisError on duplicate names or missing required fields
   */
  private normalizeReviewers(raw: RawConfig): ReviewerConfig[] {
    if (!raw.reviewers) {
      return [];
    }

    const seen = new Set<string>();

    return raw.reviewers.map((entry) => {
      const name = entry.name ?? "(unnamed)";

      for (const field of ["name", "model", "apiKeyEnvVar"] as const) {
        if (!entry[field]) {
          throw errors.reviewerMissingField(name, field);
        }
      }

      if (seen.has(name)) {
        throw errors.duplicateReviewerName(name);
      }

      seen.add(name);

      return {
        name,
        model: entry.model!,
        apiKeyEnvVar: entry.apiKeyEnvVar!,
        ...(entry.baseUrl !== undefined && { baseUrl: entry.baseUrl }),
        ...(entry.temperature !== undefined && { temperature: entry.temperature }),
        ...(entry.provider !== undefined && { provider: entry.provider }),
        ...(entry.options !== undefined && { options: entry.options }),
      };
    });
  }

  /** Normalizes raw plugin entries: strings become `{ name: theString }`. */
  /**
   * Validates the curator entry when one is declared.
   *
   * @throws PraxisError when a declared curator omits model or
   *   apiKeyEnvVar
   */
  private normalizeCurator(raw: RawConfig): CuratorConfig | null {
    if (!raw.curator) return null;

    for (const field of ["model", "apiKeyEnvVar"] as const) {
      if (!raw.curator[field]) {
        throw errors.curatorMissingField(field);
      }
    }

    return {
      model: raw.curator.model,
      apiKeyEnvVar: raw.curator.apiKeyEnvVar,
      ...(raw.curator.baseUrl !== undefined && { baseUrl: raw.curator.baseUrl }),
      ...(raw.curator.temperature !== undefined && { temperature: raw.curator.temperature }),
      ...(raw.curator.provider !== undefined && { provider: raw.curator.provider }),
      ...(raw.curator.options !== undefined && { options: raw.curator.options }),
    } as CuratorConfig;
  }

  private normalizePlugins(raw: RawPluginEntry[]): PluginConfigEntry[] {
    return raw.map((entry) => {
      if (typeof entry === "string") {
        return { name: entry };
      }

      return entry;
    });
  }
}
