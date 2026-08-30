import type { CacheFileData } from "@/judge/cache-manager.js";

import chalk from "chalk";
import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { exists, readText } from "@/core/files.js";
import { joinPath, parentDir } from "@/core/paths.js";
import { contentHash } from "@/judge/cache-manager.js";
import { hasGlobChars } from "@/judge/spec-pattern.js";

/** All possible report states. */
export type ReportStatus = "not_validated" | "pass" | "warn" | "fail" | "stale";

/** Structured report data for a single document. */
export interface VerdictReport {
  /** Path of the reported document. */
  targetPath: string;
  /** Overall status, with staleness taking priority over the cached verdict. */
  status: ReportStatus;
  /** The cached validation entry, or null if never validated. */
  cacheData: CacheFileData | null;
  /** Content hash of the document as it exists now, or null if uncomputable. */
  currentHash: string | null;
  /** Whether the document changed since the cached validation. */
  isStale: boolean;
}

/**
 * Builds a VerdictReport from cache data and current file state.
 *
 * Staleness takes priority: if the content hash doesn't match,
 * status is "stale" regardless of the underlying cached result.
 */
export function buildReport(
  targetPath: string,
  cacheData: CacheFileData | null,
  currentHash: string | null,
): VerdictReport {
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

/**
 * Computes the current content hash for a document.
 *
 * Returns null if the document or its spec file cannot be read.
 */
export function computeCurrentHash(
  targetPath: string,
  specPath?: string,
  specFilePattern?: string,
): string | null {
  try {
    const docContent = readText(targetPath);
    const resolvedSpec =
      specPath ?? findSpecForDocument(targetPath, specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN);

    if (!resolvedSpec || !exists(resolvedSpec)) return null;

    const specContent = readText(resolvedSpec);
    return contentHash(docContent, specContent);
  } catch {
    return null;
  }
}

/** Finds the spec file in the same directory as the document. */
function findSpecForDocument(targetPath: string, specFilePattern: string): string | null {
  const dir = parentDir(targetPath);

  if (!hasGlobChars(specFilePattern)) {
    const specPath = joinPath(dir, specFilePattern);
    return exists(specPath) ? specPath : null;
  }

  const matches = fg.sync(specFilePattern, {
    cwd: dir,
    onlyFiles: true,
    absolute: true,
  });

  return matches.length > 0 ? matches[0] : null;
}

/** Divider line width for the report. */
const DIVIDER_WIDTH = 50;

/**
 * Formats and prints a validation report to stdout.
 */
export function displayReport(report: VerdictReport, verbose: boolean): void {
  console.log();
  console.log("=".repeat(DIVIDER_WIDTH));
  console.log("Validation Report");
  console.log("=".repeat(DIVIDER_WIDTH));

  // Document info
  console.log();
  console.log(`  Document:  ${report.targetPath}`);

  if (report.cacheData) {
    console.log(`  Type:      ${report.cacheData.document.type}`);
    console.log(`  Spec:      ${report.cacheData.document.spec_path}`);
    console.log(`  Validated: ${formatDate(report.cacheData.cached_at)}`);
  }

  // Status badge
  console.log();
  console.log(`  Status:    ${formatStatusBadge(report.status)}`);

  // Staleness warning
  if (report.isStale && report.cacheData) {
    console.log();
    console.log(chalk.yellow("  ! Document has changed since last validation"));
    console.log(chalk.yellow("    Run `praxis validate document <path>` to re-validate"));

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
      `  Run ${chalk.cyan("`praxis validate document " + report.targetPath + "`")} to validate.`,
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

/** Formats a status enum into a colored badge string. */
function formatStatusBadge(status: ReportStatus): string {
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
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}
