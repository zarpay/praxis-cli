import type { PraxisConfig } from "@/core/config.js";
import type {
  Verdict,
  EvalSummary,
  EvalUnit,
  TargetVerdict,
  ValidationDomain,
} from "@/domains/eval/types.js";
import type { JudgeConfig } from "@/types.js";

import chalk from "chalk";

import { PraxisProjectBase } from "@/core/base.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { readText } from "@/core/files.js";
import { baseName, joinPath, relativePath } from "@/core/paths.js";
import { Judge } from "@/domains/eval/models/judge.js";
import { JudgmentTarget } from "@/domains/eval/models/judgment-target.js";
import { TargetDiscovery } from "@/domains/eval/services/discover-targets.js";
import { cacheIdentity } from "@/domains/eval/services/judge-hash.js";
import { evaluateTarget } from "@/domains/eval/services/judge-target.js";
import { CacheManager } from "@/domains/eval/services/verdict-cache.js";
import { isCohort, unitHeading, verdictMark } from "@/domains/eval/views/progress.js";

/**
 * One evaluation run: everything a single `praxis eval run` invocation
 * does across all configured judges.
 *
 * Discovers validation domains (specs and their scoping frontmatter),
 * resolves them into evaluation units, judges every unit with every
 * judge, and aggregates results, cache statistics, and the summary.
 * The ledger records a run of this class as one run record per judge
 * (05: runs are per judge).
 */
export class EvalRun extends PraxisProjectBase {
  /** Source directories (relative to root) scanned for spec files. */
  readonly sources: string[];
  /** Whether validation stops at the first error result. */
  readonly failFast: boolean;
  /** Cache hit/miss counts accumulated across the run. */
  readonly cacheStats: { hits: number; misses: number };

  private readonly useCache: boolean;
  private readonly judges: JudgeConfig[];
  /** One namespaced cache per judge, aligned by index with `judges`. */
  private readonly cacheManagers: (CacheManager | null)[];
  private readonly specFilePattern: string;
  /** Finds the specs and units this run judges. */
  private readonly discovery: TargetDiscovery;
  private results: TargetVerdict[] = [];
  private stoppedEarly = false;
  /** Absolute paths of all .md source documents, collected per run for summary(). */
  private sourceDocs = new Set<string>();
  private validatedCount = 0;
  private totalToValidate = 0;

  constructor({
    root,
    sources,
    judges,
    ignore = [],
    useCache = true,
    failFast = false,
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
  }: {
    root: string;
    sources: string[];
    ignore?: string[];
    failFast?: boolean;
    useCache?: boolean;
    /** The judges to run; every judge evaluates every unit. */
    judges: JudgeConfig[];
    specFilePattern?: string;
  }) {
    super({ root });
    this.sources = sources;
    this.failFast = failFast;
    this.useCache = useCache;
    this.judges = judges;
    // Each judge gets its own manager bound to its identity: verdicts
    // share one file per target, keyed by (spec, judge) so they never
    // collide.
    this.cacheManagers = judges.map((judge) =>
      useCache ? new CacheManager({ projectRoot: root, judge: cacheIdentity(judge) }) : null,
    );
    this.specFilePattern = specFilePattern;
    this.cacheStats = { hits: 0, misses: 0 };
    this.discovery = new TargetDiscovery({
      root,
      sources,
      specFilePattern,
      absoluteIgnore: ignore.map((p) => joinPath(root, p)),
    });
  }

  /**
   * Builds a run from a project's config.
   *
   * Every caller projects the same five fields off config and varies
   * only the run-scoped choices — which judges, whether to stop at the
   * first error, whether to consult the cache — so the projection lives
   * here rather than being restated at each call site.
   *
   * Omitted overrides fall back to the constructor's defaults: all
   * configured judges, no fail-fast, cache enabled.
   */
  static forProject(
    root: string,
    config: PraxisConfig,
    overrides: { judges?: JudgeConfig[]; failFast?: boolean; useCache?: boolean } = {},
  ): EvalRun {
    return new EvalRun({
      root,
      ignore: config.ignore,
      sources: config.sources,
      useCache: overrides.useCache,
      failFast: overrides.failFast,
      specFilePattern: config.specFilePattern,
      judges: overrides.judges ?? config.judges,
    });
  }

  /** Whether validation was stopped early due to fail-fast. */
  get stopped(): boolean {
    return this.stoppedEarly;
  }

  /** The accumulated validation results. */
  getResults(): TargetVerdict[] {
    return this.results;
  }

  /**
   * Validates all documents across all discovered validation domains.
   *
   * Scans source directories for spec files, then validates every
   * document each spec targets. Respects fail-fast if enabled.
   */
  async validateAll(): Promise<TargetVerdict[]> {
    return this.runValidation(this.discovery.domains());
  }

  /**
   * Validates all documents of a specific type.
   *
   * @param type - Type string to filter by (matches directory name or relative path)
   * @throws Error if no matching type is found
   */
  async validateType(type: string): Promise<TargetVerdict[]> {
    const domains = this.discovery.domains();
    const matching = domains.filter((d) => d.type === type || baseName(d.dir) === type);

    if (matching.length === 0) {
      throw errors.unknownDocumentType(type);
    }

    return this.runValidation(matching);
  }

  /**
   * Resets state and validates every document targeted by the given domains.
   *
   * Shared implementation behind validateAll() and validateType().
   */
  private async runValidation(domains: ValidationDomain[]): Promise<TargetVerdict[]> {
    this.results = [];
    this.stoppedEarly = false;
    this.sourceDocs = this.discovery.sourceDocuments();

    const unitQueue = domains.flatMap((domain) =>
      this.discovery.units(domain).map((unit) => ({ unit, domain })),
    );

    this.validatedCount = 0;
    this.totalToValidate = unitQueue.length * this.judges.length;

    // Judge-major order: each judge works through the full unit list,
    // keeping one instrument's output contiguous in the terminal.
    for (const [index, judge] of this.judges.entries()) {
      for (const { unit, domain } of unitQueue) {
        if (this.stoppedEarly) break;

        await this.validateUnit(unit, domain.specPath, domain.type, judge, index);
        this.checkFailFast();
      }
    }

    return this.results;
  }

  /**
   * Returns the path of every evaluation unit the discovered specs target.
   *
   * Under `by_file` these are files of any extension; under
   * `cohort: by_directory` each matched directory is one unit. Used by
   * status to compute accurate coverage counts.
   */
  listTargetFiles(): string[] {
    const domains = this.discovery.domains();
    return domains.flatMap((domain) => this.discovery.units(domain).map((unit) => unit.path));
  }

  /**
   * Computes an aggregated summary of all validation results.
   *
   * `total` covers every document seen: all .md documents in the source
   * directories plus any files validated via spec `paths:` targeting
   * (which may live outside the sources and have any extension).
   * `notValidated` is the count of those documents no result covers —
   * source documents without a spec, or targets skipped by fail-fast.
   */
  summary(): EvalSummary {
    const byType: EvalSummary["byType"] = {};

    for (const result of this.results) {
      if (!byType[result.type]) {
        byType[result.type] = { total: 0, compliant: 0, issues: 0 };
      }

      byType[result.type].total++;

      if (result.compliant) {
        byType[result.type].compliant++;
      } else {
        byType[result.type].issues++;
      }
    }

    const byJudge: EvalSummary["byJudge"] = {};

    for (const result of this.results) {
      byJudge[result.judge] ??= { compliant: 0, warnings: 0, errors: 0 };

      if (result.compliant) {
        byJudge[result.judge].compliant++;
      } else if (result.severity === "warning") {
        byJudge[result.judge].warnings++;
      } else {
        byJudge[result.judge].errors++;
      }
    }

    const validatedPaths = new Set(this.results.map((r) => r.path));
    const allDocs = new Set([...this.sourceDocs, ...validatedPaths]);

    return {
      total: allDocs.size,
      compliant: this.results.filter((r) => r.compliant).length,
      warnings: this.results.filter((r) => !r.compliant && r.severity === "warning").length,
      errors: this.results.filter((r) => !r.compliant && r.severity === "error").length,
      notValidated: allDocs.size - validatedPaths.size,
      byType,
      byJudge,
    };
  }

  /** Checks if the last result triggers fail-fast (stops on errors, not warnings). */
  private checkFailFast(): void {
    if (!this.failFast) return;

    const lastResult = this.results[this.results.length - 1];

    if (lastResult && !lastResult.compliant && lastResult.severity === "error") {
      this.stoppedEarly = true;
    }
  }

  /**
   * Validates one evaluation unit and appends the result.
   *
   * Single-file units judge the file as-is; cohort units assemble every
   * member into one path-labeled judgment input, so the set receives a
   * single verdict whose cache entry is keyed on the member contents.
   * Tracks cache hit/miss statistics for reporting.
   */
  private async validateUnit(
    unit: EvalUnit,
    specPath: string,
    type: string,
    judgeConfig: JudgeConfig,
    judgeIndex: number,
  ): Promise<void> {
    this.validatedCount++;

    this.out.print([
      "",
      unitHeading({
        index: this.validatedCount,
        total: this.totalToValidate,
        path: unit.path,
        cohortSize: isCohort(unit) ? unit.files.length : undefined,
        judgeName: this.judges.length > 1 ? judgeConfig.name : undefined,
      }),
    ]);

    const identity = {
      path: unit.path,
      type,
      filename: baseName(unit.path),
      judge: judgeConfig.name,
    };

    try {
      const verdict = await this.judgeUnit(unit, specPath, judgeConfig, judgeIndex);

      this.out.print([
        `\t${verdictMark(verdict)}`,
        ...(verdict.compliant ? [] : verdict.issues.map((issue) => `\t${chalk.dim("·")} ${issue}`)),
      ]);
      this.results.push({ ...verdict, ...identity });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      this.out.print([`\t${chalk.red("✗ ERROR")}`, `\t${chalk.dim("·")} ${message}`]);
      this.results.push({
        ...identity,
        compliant: false,
        severity: "error",
        issues: [`Validation failed: ${message}`],
        reason: message,
      });
    }
  }

  /**
   * Judges one unit and records whether the verdict came from cache.
   *
   * A cohort is assembled into one path-labeled input and judged as a
   * single target, so the set receives one verdict.
   */
  private async judgeUnit(
    unit: EvalUnit,
    specPath: string,
    judgeConfig: JudgeConfig,
    judgeIndex: number,
  ): Promise<Verdict> {
    const cohort = isCohort(unit);
    const target = JudgmentTarget.resolve({
      targetPath: unit.path,
      targetContent: cohort ? this.assembleCohort(unit) : undefined,
      kind: cohort ? "cohort" : "file",
      specPath,
      specFilePattern: this.specFilePattern,
      root: this.root,
    });

    const { verdict, cacheHit } = await evaluateTarget({
      target,
      judge: Judge.fromConfig(judgeConfig),
      cache: this.cacheManagers[judgeIndex] ?? null,
      root: this.root,
    });

    if (cacheHit) {
      this.cacheStats.hits++;
    } else {
      this.cacheStats.misses++;
    }

    return verdict;
  }

  /**
   * Assembles a cohort's members into one judgment input, each labeled
   * with its project-relative path so critiques can locate their file.
   */
  private assembleCohort(unit: EvalUnit): string {
    return unit.files
      .map((file) => `===== FILE: ${relativePath(this.root, file)} =====\n\n${readText(file)}`)
      .join("\n\n");
  }
}
