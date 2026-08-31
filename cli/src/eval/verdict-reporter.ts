import type { CacheFileData } from "@/eval/cache-manager.js";

import chalk from "chalk";
import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { exists, readText } from "@/core/files.js";
import { joinPath, parentDir } from "@/core/paths.js";
import { hasGlobChars } from "@/core/spec-pattern.js";
import { contentHash } from "@/eval/cache-manager.js";
import { assistHashInput, resolveAssistInputs } from "@/eval/judgment-input.js";

/** All possible report states. */
export type ReportStatus = "not_validated" | "pass" | "warn" | "fail" | "stale";

/** Structured report data for a single target. */
export interface VerdictReport {
  /** Path of the reported target. */
  targetPath: string;
  /** Overall status, with staleness taking priority over the cached verdict. */
  status: ReportStatus;
  /** The cached validation entry, or null if never validated. */
  cacheData: CacheFileData | null;
  /** Content hash of the target as it exists now, or null if uncomputable. */
  currentHash: string | null;
  /** Whether the target changed since the cached validation. */
  isStale: boolean;
}

/** Divider line width for the rendered report. */
const DIVIDER_WIDTH = 50;

/**
 * Reports a target's cached verdict state without any API call.
 *
 * Two public methods, kept deliberately separate (07, presentation
 * idiom): build() derives pure structured data — recomputing the
 * target's current content hash to detect staleness — and display()
 * renders a report for the terminal.
 */
export class VerdictReporter {
  private readonly specFilePattern: string;
  /** Project root the spec's assist-input globs resolve against. */
  private readonly root?: string;

  constructor({
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
    root,
  }: {
    specFilePattern?: string;
    /** Required for accurate staleness on specs declaring exemplars:/context:. */
    root?: string;
  } = {}) {
    this.specFilePattern = specFilePattern;
    this.root = root;
  }

  /**
   * Builds a target's report from its cached verdict data.
   *
   * Staleness takes priority: when the recomputed content hash differs
   * from the cached one, status is "stale" regardless of the underlying
   * cached result. An uncomputable hash (missing target or spec) skips
   * the staleness check rather than inventing one.
   */
  build(targetPath: string, cacheData: CacheFileData | null): VerdictReport {
    const currentHash = this.currentHash(targetPath, cacheData?.document.spec_path);

    if (!cacheData) {
      return { targetPath, status: "not_validated", cacheData: null, currentHash, isStale: false };
    }

    const isStale = currentHash !== null && cacheData.content_hash !== currentHash;

    if (isStale) {
      return { targetPath, status: "stale", cacheData, currentHash, isStale };
    }

    if (cacheData.result.compliant) {
      return { targetPath, status: "pass", cacheData, currentHash, isStale: false };
    }

    if (cacheData.result.severity === "warning") {
      return { targetPath, status: "warn", cacheData, currentHash, isStale: false };
    }

    return { targetPath, status: "fail", cacheData, currentHash, isStale: false };
  }

  /** Renders a report to stdout. */
  display(report: VerdictReport, verbose: boolean): void {
    console.log();
    console.log("=".repeat(DIVIDER_WIDTH));
    console.log("Validation Report");
    console.log("=".repeat(DIVIDER_WIDTH));

    // Target info
    console.log();
    console.log(`  Document:  ${report.targetPath}`);

    if (report.cacheData) {
      console.log(`  Type:      ${report.cacheData.document.type}`);
      console.log(`  Spec:      ${report.cacheData.document.spec_path}`);
      console.log(`  Validated: ${this.formatDate(report.cacheData.cached_at)}`);
    }

    // Status badge
    console.log();
    console.log(`  Status:    ${this.statusBadge(report.status)}`);

    // Staleness warning
    if (report.isStale && report.cacheData) {
      console.log();
      console.log(chalk.yellow("  ! Document has changed since last validation"));
      console.log(chalk.yellow("    Run `praxis eval run <target>` to re-validate"));

      // Show the underlying cached result for context
      const cachedStatus = report.cacheData.result.compliant
        ? "PASS"
        : report.cacheData.result.severity === "warning"
          ? "WARN"
          : "FAIL";
      const issueCount = report.cacheData.result.issues.length;
      console.log();
      console.log(
        `  Last result: [${cachedStatus}]${issueCount > 0 ? ` (${issueCount} issue${issueCount === 1 ? "" : "s"})` : ""}`,
      );
    }

    // Issues
    if (
      report.cacheData &&
      !report.cacheData.result.compliant &&
      report.cacheData.result.issues.length > 0
    ) {
      console.log();
      console.log("  Issues:");

      for (const issue of report.cacheData.result.issues) {
        console.log(`    - ${issue}`);
      }
    }

    // Not validated guidance
    if (report.status === "not_validated") {
      console.log();
      console.log(
        `  Run ${chalk.cyan("`praxis eval run " + report.targetPath + "`")} to validate.`,
      );
    }

    // Verbose: full AI reasoning
    if (verbose && report.cacheData) {
      console.log();
      console.log("-".repeat(DIVIDER_WIDTH));
      console.log("AI Reasoning:");
      console.log("-".repeat(DIVIDER_WIDTH));
      console.log(report.cacheData.result.reason);
    }

    console.log();
    console.log("=".repeat(DIVIDER_WIDTH));
  }

  /**
   * Computes the target's current content hash, resolving the spec from
   * the cached spec path when available, otherwise from the target's
   * own directory. Assist inputs (exemplars:/context:) join the hash
   * exactly as they do in the Judge.
   *
   * Returns null when the target, its spec, or its assist inputs cannot
   * be resolved — skipping the staleness check rather than inventing one.
   */
  private currentHash(targetPath: string, specPath?: string): string | null {
    try {
      const targetContent = readText(targetPath);
      const resolvedSpec = specPath ?? this.findSpec(targetPath);

      if (!resolvedSpec || !exists(resolvedSpec)) return null;

      const specContent = readText(resolvedSpec);
      const assist = resolveAssistInputs({
        specContent,
        specPath: resolvedSpec,
        root: this.root,
      });

      return contentHash(targetContent, specContent, assistHashInput(assist));
    } catch {
      return null;
    }
  }

  /** Finds the spec file in the same directory as the target. */
  private findSpec(targetPath: string): string | null {
    const dir = parentDir(targetPath);

    if (!hasGlobChars(this.specFilePattern)) {
      const specPath = joinPath(dir, this.specFilePattern);
      return exists(specPath) ? specPath : null;
    }

    const matches = fg.sync(this.specFilePattern, {
      cwd: dir,
      onlyFiles: true,
      absolute: true,
    });

    return matches.length > 0 ? matches[0] : null;
  }

  /** Formats a status enum into a colored badge string. */
  private statusBadge(status: ReportStatus): string {
    switch (status) {
      case "pass":
        return chalk.green("[PASS]") + " Document is compliant";
      case "warn":
        return chalk.yellow("[WARN]") + " Document has warnings";
      case "fail":
        return chalk.red("[FAIL]") + " Document has errors";
      case "stale":
        return chalk.yellow("[STALE]") + " Cached result is outdated";
      case "not_validated":
        return chalk.gray("[NOT VALIDATED]") + " No cached result found";
    }
  }

  /** Formats an ISO date string into a human-readable local string. */
  private formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  }
}
