import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN, PraxisConfig } from "@/core/config.js";
import { exists, writeText } from "@/core/files.js";
import { baseName, joinPath } from "@/core/paths.js";
import { Logger } from "@/core/logger.js";
import { isSpecFile } from "@/validator/spec-pattern.js";

import { Frontmatter } from "./frontmatter.js";
import { GlobExpander } from "./glob-expander.js";
import { Markdown } from "./markdown.js";
import { type AgentMetadata, OutputBuilder } from "./output-builder.js";
import { resolvePlugins } from "./plugin-registry.js";
import type { CompilerPlugin } from "./plugins/types.js";

/**
 * Compiles role definition files into agent profiles and plugin-specific output.
 *
 * Reads a role's frontmatter manifest, resolves all referenced content
 * (constitution, context, responsibilities, references), inlines their
 * body content (stripping frontmatter), and writes output based on config:
 *
 * - Pure agent profiles to `agentProfilesDir` (if configured)
 * - Plugin-specific output for each enabled plugin (e.g. Claude Code)
 */
export class RoleCompiler {
  private readonly root: string;
  private readonly logger: Logger;
  private readonly config: PraxisConfig;
  private readonly globExpander: GlobExpander;
  private readonly specFilePattern: string;
  private readonly plugins: CompilerPlugin[];

  constructor({
    root,
    logger = new Logger(),
    config,
  }: {
    root: string;
    logger?: Logger;
    config?: PraxisConfig;
  }) {
    this.root = root;
    this.logger = logger;
    this.config = config ?? new PraxisConfig(root);
    this.specFilePattern = this.config.validation?.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;
    this.globExpander = new GlobExpander(root, this.specFilePattern);
    // Plugins are stateful (e.g. the Claude Code plugin writes its
    // manifest once per run), so they are instantiated once here rather
    // than per compiled role.
    this.plugins = resolvePlugins(this.config.plugins, this.root, this.logger);
  }

  /**
   * Compiles a single role file, writing output based on config.
   *
   * @param roleFile - Absolute path to the role markdown file
   * @returns The role alias, or null if the role was skipped
   */
  async compile(roleFile: string): Promise<string | null> {
    const fm = Frontmatter.fromFile(roleFile);
    const roleAlias = fm.value("alias") as string | undefined;

    if (!roleAlias) {
      this.logger.warn(`No alias found in ${roleFile}, skipping`);
      return null;
    }

    const { profile, metadata } = await this.buildRoleProfile(roleFile, fm, roleAlias);
    this.writeOutputs(profile, metadata, roleAlias);

    this.logger.success(`Compiled ${roleAlias.toLowerCase()}.md`);
    return roleAlias;
  }

  /**
   * Compiles all role files found in the project's roles directory.
   *
   * Skips templates (`_template.md`), spec files, and roles without
   * an alias (compile() logs a warning for the latter).
   *
   * @returns Summary with the count of compiled agents
   */
  async compileAll(): Promise<{ compiled: number }> {
    const roleFiles = await fg("*.md", {
      cwd: this.config.rolesDir,
      onlyFiles: true,
      absolute: true,
    });

    let compiled = 0;

    for (const roleFile of roleFiles) {
      const name = baseName(roleFile);
      if (name === "_template.md" || isSpecFile(name, this.specFilePattern)) {
        continue;
      }

      const alias = await this.compile(roleFile);
      if (alias) compiled++;
    }

    this.logger.info(`Compiled ${compiled} agent(s) (up-to-date)`);
    return { compiled };
  }

  /**
   * Builds the pure profile content and metadata for a role.
   */
  private async buildRoleProfile(
    roleFile: string,
    fm: Frontmatter,
    roleAlias: string,
  ): Promise<{ profile: string; metadata: AgentMetadata | null }> {
    const md = new Markdown(roleFile);
    const metadata = this.buildAgentMetadata(fm, roleAlias);
    const builder = new OutputBuilder();

    builder.addRole(md.body());
    builder.addResponsibilities(await this.inlineRefs(fm, "responsibilities"));
    builder.addConstitution(await this.inlineConstitution(fm));
    builder.addContext(await this.inlineRefs(fm, "context"));
    builder.addReference(await this.inlineRefs(fm, "refs"));

    return { profile: builder.buildProfile(), metadata };
  }

  /**
   * Routes compiled output to configured destinations.
   *
   * Writes pure profiles to agentProfilesDir (if set), then
   * delegates to each enabled plugin for platform-specific output.
   */
  private writeOutputs(profile: string, metadata: AgentMetadata | null, roleAlias: string): void {
    // Write pure agent profile if configured
    const profilesDir = this.config.agentProfilesOutputDir;
    if (profilesDir) {
      const validates = metadata?.validates;
      const content =
        validates && validates.length > 0
          ? `---\npaths:\n${validates.map((p) => `  - "${p}"`).join("\n")}\n---\n\n${profile}`
          : profile;
      writeText(joinPath(profilesDir, `${roleAlias.toLowerCase()}.md`), content);
    }

    // Run each enabled plugin
    for (const plugin of this.plugins) {
      plugin.compile(profile, metadata, roleAlias);
    }
  }

  /**
   * Resolves constitution frontmatter to glob patterns.
   *
   * Supports:
   * - `constitution: true` (deprecated, warns and returns empty)
   * - `constitution: "context/constitution/*.md"` (string glob pattern)
   * - `constitution: ["context/constitution/*.md"]` (array of patterns)
   *
   * @returns Array of relative paths to constitution files
   */
  private async resolveConstitutionPatterns(fm: Frontmatter): Promise<string[]> {
    const raw = fm.parse()["constitution"];
    if (!raw) {
      return [];
    }
    if (raw === true) {
      this.logger.warn(
        'constitution: true is deprecated. Use an explicit path like: constitution: "context/constitution/*.md"',
      );
      return [];
    }
    const patterns = Array.isArray(raw) ? (raw as string[]) : [raw as string];
    return this.globExpander.expandAll(patterns);
  }

  /**
   * Reads and returns the body content of all constitution files.
   *
   * @returns Array of body strings with frontmatter stripped
   */
  private async inlineConstitution(fm: Frontmatter): Promise<string[]> {
    const raw = fm.parse()["constitution"];
    const expanded = await this.resolveConstitutionPatterns(fm);

    if (raw && raw !== true && expanded.length === 0) {
      this.logger.warn("Constitution patterns matched zero files");
    }

    return this.readBodies(expanded, "Constitution file not found");
  }

  /**
   * Expands frontmatter array references and inlines their body content.
   *
   * Used for responsibilities, context, and refs sections. Warns on
   * glob patterns that match nothing so authors catch typos early.
   *
   * @param fm - The parsed frontmatter
   * @param key - The frontmatter key to read (e.g. "responsibilities", "context", "refs")
   * @returns Array of body strings with frontmatter stripped
   */
  private async inlineRefs(fm: Frontmatter, key: string): Promise<string[]> {
    const patterns = fm.array(key) as string[];
    const expanded: string[] = [];

    for (const pattern of patterns) {
      const matches = await this.globExpander.expand(pattern);
      if (this.globExpander.isGlob(pattern) && matches.length === 0) {
        this.logger.warn(`Glob pattern matched zero files: ${pattern}`);
      }
      expanded.push(...matches);
    }

    return this.readBodies(expanded, "Referenced file not found");
  }

  /**
   * Reads the markdown body of each referenced file, skipping (and
   * warning about) any that do not exist.
   *
   * @param relPaths - Paths relative to the project root
   * @param missingLabel - Warning prefix used when a file is absent
   * @returns Array of body strings with frontmatter stripped
   */
  private readBodies(relPaths: string[], missingLabel: string): string[] {
    return relPaths
      .map((relPath) => {
        const fullPath = joinPath(this.root, relPath);
        if (!exists(fullPath)) {
          this.logger.warn(`${missingLabel}: ${relPath}`);
          return null;
        }
        return new Markdown(fullPath).body();
      })
      .filter((body): body is string => body !== null);
  }

  /**
   * Builds agent metadata from role frontmatter.
   *
   * Extracts the agent name (from alias), description, and optional
   * fields (tools, model, permission mode). Returns null if no
   * `description` is provided.
   */
  private buildAgentMetadata(fm: Frontmatter, roleAlias: string): AgentMetadata | null {
    const name = roleAlias
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const description = fm.value("description") as string | undefined;
    if (!description) {
      this.logger.warn("No description found in role, skipping agent metadata");
      return null;
    }

    const metadata: AgentMetadata = { name, description };

    const tools = fm.value("agent_tools") as string | undefined;
    if (tools) metadata.tools = tools;

    const model = fm.value("agent_model") as string | undefined;
    if (model) metadata.model = model;

    const permissionMode = fm.value("agent_permission_mode") as string | undefined;
    if (permissionMode) metadata.permissionMode = permissionMode;

    const validates = fm.array("validates") as string[];
    if (validates.length > 0) metadata.validates = validates;

    return metadata;
  }
}
