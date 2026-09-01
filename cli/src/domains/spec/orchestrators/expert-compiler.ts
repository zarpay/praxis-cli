import type { AgentMetadata, CompilerPlugin } from "@/domains/spec/types.js";
import type { PraxisProjectBaseOptions } from "@/types.js";

import fg from "fast-glob";

import { PraxisProjectBase } from "@/core/base.js";
import { exists, writeText } from "@/core/files.js";
import { baseName, joinPath } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";
import { ExpertFile } from "@/domains/spec/models/expert-file.js";
import { OutputBuilder } from "@/domains/spec/services/build-profile.js";
import { GlobExpander } from "@/domains/spec/services/glob-expander.js";
import { Markdown } from "@/domains/spec/services/markdown.js";
import { resolvePlugins } from "@/domains/spec/services/plugin-registry.js";
import { evalTargetingLines } from "@/domains/spec/views/targeting.js";

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
export class ExpertCompiler extends PraxisProjectBase {
  private readonly globExpander: GlobExpander;
  private readonly specFilePattern: string;
  private readonly plugins: CompilerPlugin[];

  constructor(options: PraxisProjectBaseOptions) {
    super(options);
    this.specFilePattern = this.config.specFilePattern;
    this.globExpander = new GlobExpander(this.root, this.specFilePattern);
    // Plugins are stateful (e.g. the Claude Code plugin writes its
    // manifest once per run), so they are instantiated once here rather
    // than per compiled role.
    this.plugins = resolvePlugins(this.config.plugins, this.root, this.logger);
  }

  /**
   * Compiles a single role file, writing output based on config.
   *
   * @param expertFile - Absolute path to the role markdown file
   * @returns The compiled expert's alias
   * @throws PraxisError when the file is not a valid expert document
   */
  async compile(expertFile: string): Promise<string> {
    const expert = ExpertFile.at(expertFile);
    const alias = expert.alias;
    const { profile, metadata } = await this.buildExpertProfile(expert);
    this.writeOutputs(profile, metadata, alias);

    this.logger.success(`Compiled ${alias.toLowerCase()}.md`);
    return alias;
  }

  /**
   * Compiles all role files found in the project's roles directory.
   *
   * Skips templates (underscore-prefixed files) and spec files. A file
   * that is not a valid expert is warned about and skipped.
   *
   * @returns Summary with the count of compiled agents
   */
  async compileAll(): Promise<{ compiled: number }> {
    const expertFiles = await fg("*.md", {
      cwd: this.config.expertsDir,
      onlyFiles: true,
      absolute: true,
    });

    let compiled = 0;

    for (const expertFile of expertFiles) {
      const name = baseName(expertFile);

      // Underscore-prefixed files are templates/scratch — the same
      // rule the eval layer applies when collecting judgment targets.
      if (name.startsWith("_") || isSpecFile(name, this.specFilePattern)) {
        continue;
      }

      // A malformed expert is reported and skipped, never fatal: one
      // bad file in the directory must not abandon every other agent.
      try {
        await this.compile(expertFile);
        compiled++;
      } catch (err) {
        this.logger.warn(`Skipping ${baseName(expertFile)}: ${(err as Error).message}`);
      }
    }

    this.logger.info(`Compiled ${compiled} agent(s) (up-to-date)`);
    return { compiled };
  }

  /**
   * Builds the pure profile content and metadata for a role.
   */
  private async buildExpertProfile(
    expert: ExpertFile,
  ): Promise<{ profile: string; metadata: AgentMetadata | null }> {
    const metadata = this.buildAgentMetadata(expert);
    const builder = new OutputBuilder();

    builder.addRole(expert.body());
    builder.addResponsibilities(await this.inlineRefs(expert, "practices"));
    builder.addConstitution(await this.inlineConstitution(expert));
    builder.addContext(await this.inlineRefs(expert, "context"));
    builder.addReference(await this.inlineRefs(expert, "refs"));

    return { profile: builder.buildProfile(), metadata };
  }

  /**
   * Routes compiled output to configured destinations.
   *
   * Writes pure profiles to agentProfilesDir (if set), then
   * delegates to each enabled plugin for platform-specific output.
   */
  private writeOutputs(profile: string, metadata: AgentMetadata | null, alias: string): void {
    // Write pure agent profile if configured
    const profilesDir = this.config.agentProfilesOutputDir;

    if (profilesDir) {
      const targeting = metadata ? evalTargetingLines(metadata) : [];
      const content =
        targeting.length > 0 ? `---\n${targeting.join("\n")}\n---\n\n${profile}` : profile;

      writeText(joinPath(profilesDir, `${alias.toLowerCase()}.md`), content);
    }

    // Run each enabled plugin
    for (const plugin of this.plugins) {
      plugin.compile(profile, metadata, alias);
    }
  }

  /**
   * Reads and returns the body content of all constitution files.
   *
   * The `constitution:` key takes a glob pattern or an array of them;
   * a declared constitution that matches nothing gets a warning.
   *
   * @returns Array of body strings with frontmatter stripped
   */
  private async inlineConstitution(expert: ExpertFile): Promise<string[]> {
    if (expert.constitution.length === 0) return [];

    const expanded = await this.globExpander.expandAll(expert.constitution);

    if (expanded.length === 0) {
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
   * @param expert - The expert being compiled
   * @param key - Which reference set to inline
   * @returns Array of body strings with frontmatter stripped
   */
  private async inlineRefs(
    expert: ExpertFile,
    key: "practices" | "context" | "refs",
  ): Promise<string[]> {
    const patterns = expert.refs(key);
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
   * Extracts the agent name (from alias) and description, plus every
   * optional field the frontmatter declares; keys absent from the
   * frontmatter stay undefined. Returns null if no `description` is
   * provided.
   */
  private buildAgentMetadata(expert: ExpertFile): AgentMetadata | null {
    const description = expert.description;

    if (!description) {
      this.logger.warn("No description found in role, skipping agent metadata");
      return null;
    }

    return {
      name: expert.agentName,
      description,
      cohort: expert.cohort,
      tools: expert.agentTools,
      model: expert.agentModel,
      excludes: expert.excludes,
      validates: expert.validates,
      exemplars: expert.exemplars,
      permissionMode: expert.agentPermissionMode,
    };
  }
}
