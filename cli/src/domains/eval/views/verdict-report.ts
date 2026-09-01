import type { CacheFileData, ReportStatus, VerdictReport } from "@/domains/eval/types.js";

import chalk from "chalk";
import fg from "fast-glob";

import { PraxisBase } from "@/core/base.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { exists, readText } from "@/core/files.js";
import { joinPath, parentDir } from "@/core/paths.js";
import { hasGlobChars } from "@/core/spec-pattern.js";
import assistHashInput from "@/domains/eval/services/build-assist-hash-input.js";
import contentHash from "@/domains/eval/services/hash-content.js";
import resolveAssistInputs from "@/domains/eval/services/resolve-assist-inputs.js";

/** Divider line width for the rendered report. */
const DIVIDER_WIDTH = 50;

/**
 * Reports a target's cached verdict state without any API call.
 *
 * Two public methods, kept deliberately separate (07, presentation
 * idiom): build() derives pure structured data — recomputing the
 * target's current content hash to detect staleness — and render()
 * displays a report on the terminal.
 */
export class VerdictReporter extends PraxisBase {
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
    super();
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

  /** Renders a report to stdout as one payload. */
  render(report: VerdictReport, verbose: boolean): void {
    const { cacheData } = report;
    const issues = cacheData?.result.issues ?? [];
    const showIssues = cacheData && !cacheData.result.compliant && issues.length > 0;

    this.out.print([
      "",
      { header: "Validation Report", width: DIVIDER_WIDTH },
      "",
      `  Document:  ${report.targetPath}`,
      cacheData && `  Spec:      ${cacheData.document.spec_path}`,
      cacheData && `  Validated: ${this.formatDate(cacheData.cached_at)}`,
      "",
      `  Status:    ${this.statusBadge(report.status)}`,
      ...(report.isStale && cacheData
        ? [
            "",
            { text: "  ! Document has changed since last validation", color: "yellow" as const },
            { text: "    Run `praxis eval run <target>` to re-validate", color: "yellow" as const },
            "",
            `  Last result: ${this.lastResultSummary(cacheData.result)}`,
          ]
        : []),
      ...(showIssues ? ["", "  Issues:", ...issues.map((i) => `    - ${i}`)] : []),
      ...(report.status === "not_validated"
        ? ["", `  Run ${chalk.cyan("`praxis eval run " + report.targetPath + "`")} to validate.`]
        : []),
      ...(verbose && cacheData
        ? [
            "",
            { header: "AI Reasoning:", char: "-", width: DIVIDER_WIDTH },
            cacheData.result.reason,
          ]
        : []),
      "",
      "=".repeat(DIVIDER_WIDTH),
    ]);
  }

  /** Summarizes a cached verdict as `[STATUS] (n issues)` for the staleness block. */
  private lastResultSummary(result: CacheFileData["result"]): string {
    const count = result.issues.length;
    const noun = count === 1 ? "issue" : "issues";
    const suffix = count > 0 ? ` (${count} ${noun})` : "";

    return `[${this.statusLabel(result)}]${suffix}`;
  }

  /** Maps a cached verdict to its PASS/WARN/FAIL label. */
  private statusLabel(result: CacheFileData["result"]): string {
    if (result.compliant) return "PASS";

    return result.severity === "warning" ? "WARN" : "FAIL";
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
