import { basename, join, relative, resolve } from "node:path";

import type { Command } from "commander";
import chalk from "chalk";
import fg from "fast-glob";

import { Frontmatter } from "@/compiler/frontmatter.js";
import { GlobExpander } from "@/compiler/glob-expander.js";
import { DEFAULT_SPEC_FILE_PATTERN, PraxisConfig } from "@/core/config.js";
import { exists } from "@/core/files.js";
import { Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";
import { BatchValidator } from "@/validator/batch-validator.js";
import { CacheManager } from "@/validator/cache-manager.js";
import { isSpecFile } from "@/validator/spec-pattern.js";

/** Structured report of project health. */
export interface StatusReport {
  /** Document counts by content type. */
  counts: {
    roles: number;
    responsibilities: number;
    references: number;
    context: number;
  };
  /** Cached validation verdict counts across all spec targets. */
  validation: {
    pass: number;
    warn: number;
    fail: number;
    notValidated: number;
  };
  /** Responsibility files no role references. */
  orphanedResponsibilities: string[];
  /** Role references pointing at files that do not exist. */
  danglingRefs: { role: string; ref: string }[];
  /** Role files missing the `description` frontmatter field. */
  rolesMissingDescription: string[];
  /** Role glob references that match no files. */
  zeroMatchGlobs: { role: string; pattern: string }[];
  /** Responsibilities whose `owner` matches no role alias. */
  unmatchedOwners: { responsibility: string; owner: string }[];
}

/**
 * Registers the `praxis status` command.
 *
 * Performs static analysis of the project structure and reports
 * counts, orphaned files, dangling references, and other health issues.
 * Exits 1 when any structural issue is found.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show project health dashboard")
    .action(async () => {
      const logger = new Logger();
      try {
        const command = new StatusCommand({ root: new Paths().root, logger });
        const report = await command.analyze();
        command.display(report);

        if (StatusCommand.hasIssues(report)) {
          process.exitCode = 1;
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Analyzes a Praxis project's health and displays the results.
 *
 * analyze() scans configured directories, checks cross-references
 * between roles and responsibilities, and tallies cached validation
 * verdicts. display() renders the resulting report for the terminal.
 */
export class StatusCommand {
  private readonly root: string;
  private readonly config: PraxisConfig;
  private readonly logger: Logger;
  private readonly specFilePattern: string;
  private readonly globExpander: GlobExpander;
  private readonly absoluteIgnore: string[];

  constructor({
    root,
    config,
    logger = new Logger(),
  }: {
    root: string;
    config?: PraxisConfig;
    logger?: Logger;
  }) {
    this.root = root;
    this.config = config ?? new PraxisConfig(root);
    this.logger = logger;
    this.specFilePattern = this.config.validation?.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;
    this.globExpander = new GlobExpander(root, this.specFilePattern);
    this.absoluteIgnore = this.config.ignore.map((p) => resolve(root, p));
  }

  /** Whether a report contains any structural issue worth a non-zero exit. */
  static hasIssues(report: StatusReport): boolean {
    return (
      report.danglingRefs.length > 0 ||
      report.orphanedResponsibilities.length > 0 ||
      report.rolesMissingDescription.length > 0 ||
      report.zeroMatchGlobs.length > 0 ||
      report.unmatchedOwners.length > 0
    );
  }

  /** Analyzes the project and returns a structured health report. */
  async analyze(): Promise<StatusReport> {
    // Count content files by type using config-driven paths
    const roleFiles = await this.listContentFiles(this.config.rolesDir, false);
    const respFiles = await this.listContentFiles(this.config.responsibilitiesDir, false);

    // Scan all sources for reference and context files by frontmatter type
    let references = 0;
    let contextCount = 0;
    for (const source of this.config.sources) {
      const sourceDir = resolve(this.root, source);
      const allFiles = await this.listContentFiles(sourceDir, true);
      for (const file of allFiles) {
        const type = Frontmatter.fromFile(file).value("type") as string | undefined;
        if (type === "reference") references++;
        else if (type === "convention" || type === "constitution") contextCount++;
      }
    }

    // Build role alias map and check roles
    const roleAliases = new Map<string, string>();
    const allReferencedResps = new Set<string>();
    const danglingRefs: StatusReport["danglingRefs"] = [];
    const zeroMatchGlobs: StatusReport["zeroMatchGlobs"] = [];
    const rolesMissingDescription: string[] = [];

    for (const roleFile of roleFiles) {
      const fm = Frontmatter.fromFile(roleFile);
      const alias = fm.value("alias") as string | undefined;
      const roleName = basename(roleFile);

      if (alias) {
        roleAliases.set(alias.toLowerCase(), roleName);
      }

      if (!fm.value("description")) {
        rolesMissingDescription.push(roleName);
      }

      // Check all ref-type keys
      for (const key of ["responsibilities", "context", "refs"]) {
        const patterns = fm.array(key) as string[];

        for (const pattern of patterns) {
          if (this.globExpander.isGlob(pattern)) {
            const matches = await this.globExpander.expand(pattern);
            if (matches.length === 0) {
              zeroMatchGlobs.push({ role: roleName, pattern });
            }
            if (key === "responsibilities") {
              for (const m of matches) allReferencedResps.add(m);
            }
          } else {
            const fullPath = join(this.root, pattern);
            if (!exists(fullPath)) {
              danglingRefs.push({ role: roleName, ref: pattern });
            }
            if (key === "responsibilities") {
              allReferencedResps.add(pattern);
            }
          }
        }
      }
    }

    // Find orphaned responsibilities
    const orphanedResponsibilities: string[] = [];
    for (const respFile of respFiles) {
      const relPath = relative(this.root, respFile);
      if (!allReferencedResps.has(relPath)) {
        orphanedResponsibilities.push(basename(respFile));
      }
    }

    // Find unmatched owners
    const unmatchedOwners: StatusReport["unmatchedOwners"] = [];
    for (const respFile of respFiles) {
      const owner = Frontmatter.fromFile(respFile).value("owner") as string | undefined;
      if (owner && !roleAliases.has(owner.toLowerCase())) {
        unmatchedOwners.push({ responsibility: basename(respFile), owner });
      }
    }

    return {
      counts: {
        roles: roleFiles.length,
        responsibilities: respFiles.length,
        references,
        context: contextCount,
      },
      validation: this.tallyValidation(),
      orphanedResponsibilities,
      danglingRefs,
      rolesMissingDescription,
      zeroMatchGlobs,
      unmatchedOwners,
    };
  }

  /** Displays the status report to the console. */
  display(report: StatusReport): void {
    this.logger.info("Praxis Project Status");
    console.log();
    console.log(`  Roles:              ${report.counts.roles}`);
    console.log(`  Responsibilities:   ${report.counts.responsibilities}`);
    console.log(`  References:         ${report.counts.references}`);
    console.log(`  Context files:      ${report.counts.context}`);

    // Validation summary
    const v = report.validation;
    const totalDocs = v.pass + v.warn + v.fail + v.notValidated;
    if (totalDocs > 0) {
      console.log();
      this.logger.info("Validation");
      console.log(`  ${chalk.green("[PASS]")} ${v.pass}`);
      console.log(`  ${chalk.yellow("[WARN]")} ${v.warn}`);
      console.log(`  ${chalk.red("[FAIL]")} ${v.fail}`);
      console.log(`  ${chalk.gray("[NOT VALIDATED]")} ${v.notValidated}`);
    }

    let issueCount = 0;

    if (report.danglingRefs.length > 0) {
      console.log();
      this.logger.warn("Dangling references (file not found):");
      for (const { role, ref } of report.danglingRefs) {
        console.log(`  ${role} → ${ref}`);
        issueCount++;
      }
    }

    if (report.orphanedResponsibilities.length > 0) {
      console.log();
      this.logger.warn("Orphaned responsibilities (not referenced by any role):");
      for (const resp of report.orphanedResponsibilities) {
        console.log(`  ${resp}`);
        issueCount++;
      }
    }

    if (report.rolesMissingDescription.length > 0) {
      console.log();
      this.logger.warn("Roles missing description:");
      for (const role of report.rolesMissingDescription) {
        console.log(`  ${role}`);
        issueCount++;
      }
    }

    if (report.zeroMatchGlobs.length > 0) {
      console.log();
      this.logger.warn("Glob patterns matching zero files:");
      for (const { role, pattern } of report.zeroMatchGlobs) {
        console.log(`  ${role}: ${pattern}`);
        issueCount++;
      }
    }

    if (report.unmatchedOwners.length > 0) {
      console.log();
      this.logger.warn("Responsibilities with unknown owners:");
      for (const { responsibility, owner } of report.unmatchedOwners) {
        console.log(`  ${responsibility} (owner: ${owner})`);
        issueCount++;
      }
    }

    console.log();
    if (issueCount === 0) {
      this.logger.success("No issues found");
    } else {
      this.logger.info(`${issueCount} issue(s) found`);
    }
  }

  /**
   * Tallies cached validation verdicts across all spec-targeted files.
   *
   * Discovers targets via BatchValidator (any file extension, including
   * files reached through spec `paths:` frontmatter) and reads each
   * file's cached verdict without making API calls.
   */
  private tallyValidation(): StatusReport["validation"] {
    const cacheManager = new CacheManager(undefined, this.root);
    const batchValidator = new BatchValidator({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      specFilePattern: this.specFilePattern,
    });

    const validation = { pass: 0, warn: 0, fail: 0, notValidated: 0 };

    for (const filePath of batchValidator.listTargetFiles()) {
      const cached = cacheManager.readRaw({ documentPath: filePath });
      if (!cached) {
        validation.notValidated++;
      } else if (cached.result.compliant) {
        validation.pass++;
      } else if (cached.result.severity === "warning") {
        validation.warn++;
      } else {
        validation.fail++;
      }
    }

    return validation;
  }

  /**
   * Lists content files in a directory, excluding templates and spec files.
   *
   * @param dir - Absolute path to the content directory
   * @param recursive - Whether to search subdirectories
   */
  private async listContentFiles(dir: string, recursive: boolean): Promise<string[]> {
    if (!exists(dir)) return [];

    const pattern = recursive ? "**/*.md" : "*.md";
    const files = await fg(pattern, {
      cwd: dir,
      onlyFiles: true,
      absolute: true,
      ignore: this.absoluteIgnore,
    });

    return files.filter(
      (f) => !isSpecFile(f, this.specFilePattern) && !basename(f).startsWith("_"),
    );
  }
}
