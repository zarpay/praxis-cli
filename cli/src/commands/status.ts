import type { Command } from "commander";

import type { BadgeEntry, PraxisProjectBaseOptions, StatusReport } from "@/types.js";

import fg from "fast-glob";

import { runAction } from "@/commands/action.js";
import { PraxisProjectBase } from "@/core/base.js";
import { exists } from "@/core/files.js";
import { Paths, baseName, joinPath, relativePath, resolvePath } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";
import { EvalRun } from "@/domains/eval/orchestrators/eval-run.js";
import { cacheIdentity } from "@/domains/eval/services/judge-hash.js";
import { CacheManager } from "@/domains/eval/services/verdict-cache.js";
import { DocumentFile } from "@/models/document-file.js";
import { ExpertFile } from "@/models/expert-file.js";
import { GlobExpander } from "@/spec/glob-expander.js";
import { verdictTally } from "@/views/badges.js";
import { statLines } from "@/views/stats.js";

/** The reference keys an expert can point at other documents with. */
const REF_KEYS = ["practices", "context", "refs"] as const;

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
    .action(() =>
      runAction(async () => {
        const command = new StatusCommand({ root: new Paths().root });
        const report = await command.analyze();
        command.display(report);

        if (StatusCommand.hasIssues(report)) {
          process.exitCode = 1;
        }
      }),
    );
}

/**
 * Analyzes a Praxis project's health and displays the results.
 *
 * analyze() scans configured directories, checks cross-references
 * between experts and practices, and tallies cached validation
 * verdicts. display() renders the resulting report for the terminal.
 */
export class StatusCommand extends PraxisProjectBase {
  private readonly specFilePattern: string;
  private readonly globExpander: GlobExpander;
  private readonly absoluteIgnore: string[];

  constructor(options: PraxisProjectBaseOptions) {
    super(options);
    this.specFilePattern = this.config.specFilePattern;
    this.globExpander = new GlobExpander(this.root, this.specFilePattern);
    this.absoluteIgnore = this.config.ignore.map((p) => resolvePath(this.root, p));
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
    // Framework health only applies when the spec-layer compiler is in
    // use; eval-only projects get validation state and nothing else.
    if (!exists(this.config.expertsDir)) {
      return this.evalOnlyReport();
    }

    const expertFiles = await this.listContentFiles(this.config.expertsDir, false);
    const practiceFiles = await this.listContentFiles(this.config.practicesDir, false);
    const typeCounts = await this.countTypedDocuments();
    const audit = await this.auditExperts(expertFiles);

    return {
      compilerInUse: true,
      counts: {
        experts: expertFiles.length,
        practices: practiceFiles.length,
        references: typeCounts.references,
        context: typeCounts.context,
      },
      validation: this.tallyValidation(),
      orphanedPractices: this.findOrphanedPractices(practiceFiles, audit.referencedPractices),
      danglingRefs: audit.danglingRefs,
      expertsMissingDescription: audit.missingDescriptions,
      invalidExperts: audit.invalidExperts,
      zeroMatchGlobs: audit.zeroMatchGlobs,
      unmatchedOwners: this.findUnmatchedOwners(practiceFiles, audit.aliases),
    };
  }

  /** The report for a project with no spec layer: validation state only. */
  private evalOnlyReport(): StatusReport {
    return {
      compilerInUse: false,
      counts: { experts: 0, practices: 0, references: 0, context: 0 },
      validation: this.tallyValidation(),
      orphanedPractices: [],
      danglingRefs: [],
      expertsMissingDescription: [],
      invalidExperts: [],
      zeroMatchGlobs: [],
      unmatchedOwners: [],
    };
  }

  /** Counts reference and context documents across sources by frontmatter type. */
  private async countTypedDocuments(): Promise<{ references: number; context: number }> {
    let references = 0;
    let context = 0;

    for (const source of this.config.sources) {
      const sourceDir = resolvePath(this.root, source);
      const allFiles = await this.listContentFiles(sourceDir, true);

      for (const file of allFiles) {
        const type = DocumentFile.at(file).type;

        if (type === "reference") references++;
        else if (type === "convention" || type === "constitution") context++;
      }
    }

    return { references, context };
  }

  /**
   * Audits every expert file in one pass: collects aliases and
   * referenced practices, and flags dangling refs, zero-match globs,
   * and missing descriptions.
   */
  private async auditExperts(expertFiles: string[]): Promise<{
    aliases: Map<string, string>;
    invalidExperts: StatusReport["invalidExperts"];
    referencedPractices: Set<string>;
    danglingRefs: StatusReport["danglingRefs"];
    zeroMatchGlobs: StatusReport["zeroMatchGlobs"];
    missingDescriptions: string[];
  }> {
    const aliases = new Map<string, string>();
    const invalidExperts: StatusReport["invalidExperts"] = [];
    const referencedPractices = new Set<string>();
    const danglingRefs: StatusReport["danglingRefs"] = [];
    const zeroMatchGlobs: StatusReport["zeroMatchGlobs"] = [];
    const missingDescriptions: string[] = [];

    for (const expertFile of expertFiles) {
      const expertName = baseName(expertFile);
      // Status reports on a broken document; it never dies on one.
      let expert: ExpertFile;

      try {
        expert = ExpertFile.at(expertFile);
      } catch (err) {
        invalidExperts.push({
          expert: expertName,
          reason: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const alias = expert.alias;

      aliases.set(alias.toLowerCase(), expertName);

      if (!expert.description) {
        missingDescriptions.push(expertName);
      }

      for (const key of REF_KEYS) {
        const patterns = expert.refs(key);

        for (const pattern of patterns) {
          if (this.globExpander.isGlob(pattern)) {
            const matches = await this.globExpander.expand(pattern);

            if (matches.length === 0) {
              zeroMatchGlobs.push({ expert: expertName, pattern });
            }

            if (key === "practices") {
              for (const m of matches) referencedPractices.add(m);
            }
          } else {
            if (!exists(joinPath(this.root, pattern))) {
              danglingRefs.push({ expert: expertName, ref: pattern });
            }

            if (key === "practices") {
              referencedPractices.add(pattern);
            }
          }
        }
      }
    }

    return {
      aliases,
      referencedPractices,
      danglingRefs,
      zeroMatchGlobs,
      missingDescriptions,
      invalidExperts,
    };
  }

  /** Practices no expert references, by basename. */
  private findOrphanedPractices(practiceFiles: string[], referenced: Set<string>): string[] {
    return practiceFiles
      .filter((file) => !referenced.has(relativePath(this.root, file)))
      .map((file) => baseName(file));
  }

  /** Practices whose owner: matches no expert alias. */
  private findUnmatchedOwners(
    practiceFiles: string[],
    aliases: Map<string, string>,
  ): StatusReport["unmatchedOwners"] {
    const unmatched: StatusReport["unmatchedOwners"] = [];

    for (const practiceFile of practiceFiles) {
      const owner = DocumentFile.at(practiceFile).owner;

      if (owner && !aliases.has(owner.toLowerCase())) {
        unmatched.push({ practice: baseName(practiceFile), owner });
      }
    }

    return unmatched;
  }

  /**
   * Displays the status report: eval state always, framework health
   * only when the compiler is in use.
   *
   * Every decision about *what* to show lives in the pure functions
   * below; this method only renders what they return.
   */
  display(report: StatusReport): void {
    this.logger.info("Praxis Project Status");

    if (report.compilerInUse) {
      this.out.print(["", ...countLines(report.counts)]);
    }

    // One block per judge, never pooled: judges are separate instruments.
    for (const { judge, badges } of validationBlocks(report.validation)) {
      this.out.line();
      this.logger.info(`Validation (judge: ${judge})`);
      this.out.print(badges);
    }

    if (!report.compilerInUse) return;

    const blocks = issueBlocks(report);

    for (const { heading, items } of blocks) {
      this.out.line();
      this.logger.warn(heading);
      this.out.print(items.map((item) => `  ${item}`));
    }

    const issueCount = blocks.reduce((total, block) => total + block.items.length, 0);

    this.out.line();

    if (issueCount === 0) {
      this.logger.success("No issues found");
    } else {
      this.logger.info(`${issueCount} issue(s) found`);
    }
  }

  /**
   * Tallies cached validation verdicts across all spec-targeted files.
   *
   * Discovers targets via EvalRun (any file extension, including
   * files reached through spec `paths:` frontmatter) and reads each
   * file's cached verdict without making API calls.
   */
  private tallyValidation(): StatusReport["validation"] {
    const evalRun = EvalRun.forProject(this.root, this.config);
    const targets = evalRun.listTargetFiles();

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

/** The document-count lines, label-aligned. */
export function countLines(counts: StatusReport["counts"]): string[] {
  return statLines([
    ["Experts", counts.experts],
    ["Practices", counts.practices],
    ["References", counts.references],
    ["Context files", counts.context],
  ]);
}

/**
 * One badge block per judge that has judged anything.
 *
 * A judge with no verdicts at all is dropped rather than rendered as
 * four zeros, which reads as a broken judge instead of an unused one.
 */
export function validationBlocks(
  validation: StatusReport["validation"],
): { judge: string; badges: BadgeEntry[] }[] {
  return validation
    .filter((v) => v.pass + v.warn + v.fail + v.notValidated > 0)
    .map((v) => ({ judge: v.judge, badges: verdictTally(v) }));
}

/**
 * The framework-health findings a report carries, in display order.
 *
 * Blocks with nothing to report are dropped, so the caller renders
 * every block it is given and the count of findings is the sum of their
 * items.
 */
export function issueBlocks(report: StatusReport): { heading: string; items: string[] }[] {
  const blocks = [
    {
      heading: "Dangling references (file not found):",
      items: report.danglingRefs.map(({ expert, ref }) => `${expert} → ${ref}`),
    },
    {
      heading: "Orphaned practices (not referenced by any expert):",
      items: report.orphanedPractices,
    },
    { heading: "Experts missing description:", items: report.expertsMissingDescription },
    {
      heading: "Experts that failed to parse:",
      items: report.invalidExperts.map(({ expert, reason }) => `${expert}: ${reason}`),
    },
    {
      heading: "Glob patterns matching zero files:",
      items: report.zeroMatchGlobs.map(({ expert, pattern }) => `${expert}: ${pattern}`),
    },
    {
      heading: "Practices with unknown owners:",
      items: report.unmatchedOwners.map(({ practice, owner }) => `${practice} (owner: ${owner})`),
    },
  ];

  return blocks.filter((block) => block.items.length > 0);
}
