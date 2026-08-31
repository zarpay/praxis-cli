import type { Command } from "commander";

import chalk from "chalk";
import fg from "fast-glob";

import { PraxisConfig } from "@/core/config.js";
import { exists } from "@/core/files.js";
import { Frontmatter } from "@/core/frontmatter.js";
import { Logger } from "@/core/logger.js";
import { Paths, baseName, joinPath, relativePath, resolvePath } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";
import { BatchJudge } from "@/eval/batch-judge.js";
import { CacheManager } from "@/eval/cache-manager.js";
import { cacheIdentity } from "@/eval/judge-hash.js";
import { GlobExpander } from "@/spec/glob-expander.js";

/** Structured report of project health. */
export interface StatusReport {
  /** Document counts by content type. */
  counts: {
    experts: number;
    practices: number;
    references: number;
    context: number;
  };
  /**
   * Cached verdict counts across all spec targets, one row per judge —
   * judges are separate instruments and are never silently pooled.
   * Empty when no judges are configured.
   */
  validation: {
    judge: string;
    pass: number;
    warn: number;
    fail: number;
    notValidated: number;
  }[];
  /** Practice files no expert references. */
  orphanedPractices: string[];
  /** Expert references pointing at files that do not exist. */
  danglingRefs: { expert: string; ref: string }[];
  /** Expert files missing the `description` frontmatter field. */
  expertsMissingDescription: string[];
  /** Expert glob references that match no files. */
  zeroMatchGlobs: { expert: string; pattern: string }[];
  /** Practices whose `owner` matches no expert alias. */
  unmatchedOwners: { practice: string; owner: string }[];
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
    this.specFilePattern = this.config.specFilePattern;
    this.globExpander = new GlobExpander(root, this.specFilePattern);
    this.absoluteIgnore = this.config.ignore.map((p) => resolvePath(root, p));
  }

  /** Whether a report contains any structural issue worth a non-zero exit. */
  static hasIssues(report: StatusReport): boolean {
    return (
      report.danglingRefs.length > 0 ||
      report.orphanedPractices.length > 0 ||
      report.expertsMissingDescription.length > 0 ||
      report.zeroMatchGlobs.length > 0 ||
      report.unmatchedOwners.length > 0
    );
  }

  /** Analyzes the project and returns a structured health report. */
  async analyze(): Promise<StatusReport> {
    // Count content files by type using config-driven paths
    const expertFiles = await this.listContentFiles(this.config.expertsDir, false);
    const practiceFiles = await this.listContentFiles(this.config.practicesDir, false);

    // Scan all sources for reference and context files by frontmatter type
    let references = 0;
    let contextCount = 0;
    for (const source of this.config.sources) {
      const sourceDir = resolvePath(this.root, source);
      const allFiles = await this.listContentFiles(sourceDir, true);
      for (const file of allFiles) {
        const type = Frontmatter.fromFile(file).value("type") as string | undefined;

        if (type === "reference") references++;
        else if (type === "convention" || type === "constitution") contextCount++;
      }
    }

    // Build role alias map and check roles
    const expertAliases = new Map<string, string>();
    const allReferencedPractices = new Set<string>();
    const danglingRefs: StatusReport["danglingRefs"] = [];
    const zeroMatchGlobs: StatusReport["zeroMatchGlobs"] = [];
    const expertsMissingDescription: string[] = [];

    for (const expertFile of expertFiles) {
      const fm = Frontmatter.fromFile(expertFile);
      const alias = fm.value("alias") as string | undefined;
      const expertName = baseName(expertFile);

      if (alias) {
        expertAliases.set(alias.toLowerCase(), expertName);
      }

      if (!fm.value("description")) {
        expertsMissingDescription.push(expertName);
      }

      // Check all ref-type keys
      // "practices" is the v2 key; "responsibilities" is its accepted v1 alias.
      for (const key of ["practices", "responsibilities", "context", "refs"]) {
        const patterns = fm.array(key) as string[];

        for (const pattern of patterns) {
          if (this.globExpander.isGlob(pattern)) {
            const matches = await this.globExpander.expand(pattern);

            if (matches.length === 0) {
              zeroMatchGlobs.push({ expert: expertName, pattern });
            }

            if (key === "practices" || key === "responsibilities") {
              for (const m of matches) allReferencedPractices.add(m);
            }
          } else {
            const fullPath = joinPath(this.root, pattern);

            if (!exists(fullPath)) {
              danglingRefs.push({ expert: expertName, ref: pattern });
            }

            if (key === "practices" || key === "responsibilities") {
              allReferencedPractices.add(pattern);
            }
          }
        }
      }
    }

    // Find orphaned responsibilities
    const orphanedPractices: string[] = [];
    for (const practiceFile of practiceFiles) {
      const relPath = relativePath(this.root, practiceFile);

      if (!allReferencedPractices.has(relPath)) {
        orphanedPractices.push(baseName(practiceFile));
      }
    }

    // Find unmatched owners
    const unmatchedOwners: StatusReport["unmatchedOwners"] = [];
    for (const practiceFile of practiceFiles) {
      const owner = Frontmatter.fromFile(practiceFile).value("owner") as string | undefined;

      if (owner && !expertAliases.has(owner.toLowerCase())) {
        unmatchedOwners.push({ practice: baseName(practiceFile), owner });
      }
    }

    return {
      counts: {
        experts: expertFiles.length,
        practices: practiceFiles.length,
        references,
        context: contextCount,
      },
      validation: this.tallyValidation(),
      orphanedPractices,
      danglingRefs,
      expertsMissingDescription,
      zeroMatchGlobs,
      unmatchedOwners,
    };
  }

  /** Displays the status report to the console. */
  display(report: StatusReport): void {
    this.logger.info("Praxis Project Status");
    console.log();
    console.log(`  Experts:            ${report.counts.experts}`);
    console.log(`  Practices:          ${report.counts.practices}`);
    console.log(`  References:         ${report.counts.references}`);
    console.log(`  Context files:      ${report.counts.context}`);

    // Validation summary — one block per judge, never pooled
    for (const v of report.validation) {
      const totalDocs = v.pass + v.warn + v.fail + v.notValidated;

      if (totalDocs === 0) continue;

      console.log();
      this.logger.info(`Validation (judge: ${v.judge})`);
      console.log(`  ${chalk.green("[PASS]")} ${v.pass}`);
      console.log(`  ${chalk.yellow("[WARN]")} ${v.warn}`);
      console.log(`  ${chalk.red("[FAIL]")} ${v.fail}`);
      console.log(`  ${chalk.gray("[NOT VALIDATED]")} ${v.notValidated}`);
    }

    let issueCount = 0;

    if (report.danglingRefs.length > 0) {
      console.log();
      this.logger.warn("Dangling references (file not found):");
      for (const { expert, ref } of report.danglingRefs) {
        console.log(`  ${expert} → ${ref}`);
        issueCount++;
      }
    }

    if (report.orphanedPractices.length > 0) {
      console.log();
      this.logger.warn("Orphaned practices (not referenced by any expert):");
      for (const resp of report.orphanedPractices) {
        console.log(`  ${resp}`);
        issueCount++;
      }
    }

    if (report.expertsMissingDescription.length > 0) {
      console.log();
      this.logger.warn("Experts missing description:");
      for (const role of report.expertsMissingDescription) {
        console.log(`  ${role}`);
        issueCount++;
      }
    }

    if (report.zeroMatchGlobs.length > 0) {
      console.log();
      this.logger.warn("Glob patterns matching zero files:");
      for (const { expert, pattern } of report.zeroMatchGlobs) {
        console.log(`  ${expert}: ${pattern}`);
        issueCount++;
      }
    }

    if (report.unmatchedOwners.length > 0) {
      console.log();
      this.logger.warn("Practices with unknown owners:");
      for (const { practice, owner } of report.unmatchedOwners) {
        console.log(`  ${practice} (owner: ${owner})`);
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
   * Discovers targets via BatchJudge (any file extension, including
   * files reached through spec `paths:` frontmatter) and reads each
   * file's cached verdict without making API calls.
   */
  private tallyValidation(): StatusReport["validation"] {
    const batchJudge = new BatchJudge({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      judges: this.config.judges,
      specFilePattern: this.specFilePattern,
    });
    const targets = batchJudge.listTargetFiles();

    // One cache namespace per judge; the legacy un-namespaced cache
    // when no judges are configured. Reading needs no API keys.
    const readers =
      this.config.judges.length > 0
        ? this.config.judges.map((judge) => ({
            judge: judge.name,
            manager: new CacheManager({ projectRoot: this.root, judge: cacheIdentity(judge) }),
          }))
        : [{ judge: null, manager: new CacheManager({ projectRoot: this.root }) }];

    return readers.map(({ judge, manager }) => {
      const row = {
        judge,
        pass: 0,
        warn: 0,
        fail: 0,
        notValidated: 0,
      } as StatusReport["validation"][number];

      for (const filePath of targets) {
        const cached = manager.readRaw({ targetPath: filePath });

        if (!cached) {
          row.notValidated++;
        } else if (cached.result.compliant) {
          row.pass++;
        } else if (cached.result.severity === "warning") {
          row.warn++;
        } else {
          row.fail++;
        }
      }

      return row;
    });
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
      (f) => !isSpecFile(f, this.specFilePattern) && !baseName(f).startsWith("_"),
    );
  }
}
