import type { JudgeConfig } from "@/core/config.js";
import type { Verdict } from "@/eval/cache-manager.js";

import chalk from "chalk";
import fg from "fast-glob";

import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { readText } from "@/core/files.js";
import { Frontmatter } from "@/core/frontmatter.js";
import { Display } from "@/core/logger.js";
import { baseName, joinPath, parentDir, relativePath } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";
import { CacheManager } from "@/eval/cache-manager.js";
import { cacheIdentity } from "@/eval/judge-hash.js";
import { Judge } from "@/eval/judge.js";

/** Extended validation result that includes file path and type information. */
export interface TargetVerdict extends Verdict {
  /** Absolute path of the validated document. */
  path: string;
  /** Type label of the domain that validated it (spec directory, root-relative). */
  type: string;
  /** Basename of the validated document. */
  filename: string;
  /** Name of the judge that produced this verdict. */
  judge: string;
}

/** Aggregated validation summary across all documents. */
export interface EvalSummary {
  /** All documents seen: source .md docs plus any paths:-targeted files. */
  total: number;
  /** Documents whose result was compliant. */
  compliant: number;
  /** Non-compliant results with warning severity. */
  warnings: number;
  /** Non-compliant results with error severity. */
  errors: number;
  /** Documents no result covers (no spec, or skipped by fail-fast). */
  notValidated: number;
  /** Per-type breakdown, keyed by validation domain type label. */
  byType: Record<
    string,
    {
      total: number;
      compliant: number;
      issues: number;
    }
  >;
  /**
   * Per-judge breakdown. Judges are instruments with different error
   * rates; their series render separately, never silently pooled (07).
   */
  byJudge: Record<
    string,
    {
      compliant: number;
      warnings: number;
      errors: number;
    }
  >;
}

/** How a spec groups its targets into evaluation units. */
type CohortMode = "by_file" | "by_directory";

/** The accepted `cohort:` frontmatter values. */
const COHORT_MODES: readonly CohortMode[] = ["by_file", "by_directory"];

/**
 * One evaluation unit: what receives a single verdict.
 *
 * Under `by_file` (the default) a unit is one file and `path` is that
 * file. Under `by_directory` a unit is a directory matched by the
 * spec's `paths:` patterns, `path` is the directory, and `files` are
 * every file it contains — judged together as one input.
 */
interface EvalUnit {
  path: string;
  files: string[];
}

/** A validation domain: a spec file and the targets it validates. */
interface ValidationDomain {
  /** Directory containing the spec file. */
  dir: string;
  /** Absolute path to the spec file. */
  specPath: string;
  /** Type label derived from the spec's directory (root-relative path). */
  type: string;
  /** How targets group into evaluation units. */
  cohort: CohortMode;
  /**
   * Structural exclusions from the spec's `excludes:` frontmatter,
   * resolved to absolute glob patterns. Excluded files never become
   * units and never enter cohort membership — the judge never sees
   * them (03: prevention beats calibration).
   */
  excludes: string[];
  /**
   * Spec-blessed positive examples from `exemplars:`, resolved to
   * absolute glob patterns. Shielded from adverse judgment the same way
   * excludes are; the Judge inlines them into the prompt as positives.
   */
  exemplars: string[];
  /** Explicit target files when the spec declares `paths:` (by_file). */
  targetFiles?: string[];
  /** Matched directories when the spec declares `cohort: by_directory`. */
  targetDirs?: string[];
}

/**
 * Validates multiple Praxis documents and aggregates results.
 *
 * Discovers validation domains by scanning source directories for
 * directories containing README.md files, validates each document
 * against its directory's README spec, and collects results with
 * optional fail-fast behavior and cache statistics.
 */
export class BatchJudge {
  /** Project root all paths resolve against. */
  readonly root: string;
  /** Source directories (relative to root) scanned for spec files. */
  readonly sources: string[];
  /** Whether validation stops at the first error result. */
  readonly failFast: boolean;
  /** Cache hit/miss counts accumulated across the run. */
  readonly cacheStats: { hits: number; misses: number };

  private readonly out = new Display();

  private readonly useCache: boolean;
  private readonly judges: JudgeConfig[];
  /** One namespaced cache per judge, aligned by index with `judges`. */
  private readonly cacheManagers: (CacheManager | null)[];
  private readonly specFilePattern: string;
  /** Ignore patterns resolved to absolute paths for fast-glob. */
  private readonly absoluteIgnore: string[];
  private results: TargetVerdict[] = [];
  private stoppedEarly = false;
  /** Absolute paths of all .md source documents, collected per run for summary(). */
  private sourceDocs = new Set<string>();
  private validatedCount = 0;
  private totalToValidate = 0;

  constructor({
    root,
    sources,
    ignore = [],
    failFast = false,
    useCache = true,
    judges,
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
    this.root = root;
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
    this.cacheStats = { hits: 0, misses: 0 };
    this.specFilePattern = specFilePattern;
    this.absoluteIgnore = ignore.map((p) => joinPath(root, p));
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
    return this.runValidation(this.discoverValidationDomains());
  }

  /**
   * Validates all documents of a specific type.
   *
   * @param type - Type string to filter by (matches directory name or relative path)
   * @throws Error if no matching type is found
   */
  async validateType(type: string): Promise<TargetVerdict[]> {
    const domains = this.discoverValidationDomains();
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
    this.sourceDocs = this.collectSourceDocuments();

    const unitQueue = domains.flatMap((domain) =>
      this.resolveUnits(domain).map((unit) => ({ unit, domain })),
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
    const domains = this.discoverValidationDomains();
    return domains.flatMap((domain) => this.resolveUnits(domain).map((unit) => unit.path));
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

  /**
   * Collects the absolute paths of all .md documents across source directories.
   *
   * Includes documents in directories without a spec file, providing the
   * true universe of source documents for summary() denominators.
   * Excludes spec files and templates (files starting with `_`).
   */
  private collectSourceDocuments(): Set<string> {
    const docs = new Set<string>();

    for (const source of this.sources) {
      const sourceAbsPath = joinPath(this.root, source);
      const allMdFiles = fg.sync("**/*.md", {
        cwd: sourceAbsPath,
        onlyFiles: true,
        absolute: true,
        dot: true,
        ignore: this.absoluteIgnore,
      });

      for (const file of allMdFiles) {
        const name = baseName(file);

        if (isSpecFile(name, this.specFilePattern) || name.startsWith("_")) continue;

        docs.add(file);
      }
    }

    return docs;
  }

  /**
   * Returns the evaluation units a domain should validate.
   *
   * `cohort: by_directory` domains yield one unit per matched directory,
   * containing every (non-spec, non-template) file under it; empty
   * directories yield no unit. `by_file` domains yield one unit per
   * target file — from `paths:` when declared, otherwise the spec's
   * sibling .md files.
   */
  private resolveUnits(domain: ValidationDomain): EvalUnit[] {
    const shielded = [...domain.excludes, ...domain.exemplars];

    if (domain.cohort === "by_directory") {
      return (domain.targetDirs ?? [])
        .map((dir) => ({ path: dir, files: this.collectMembers(dir, shielded) }))
        .filter((unit) => unit.files.length > 0);
    }

    if (domain.targetFiles) {
      return domain.targetFiles.map((file) => ({ path: file, files: [file] }));
    }

    return fg
      .sync("*.md", {
        cwd: domain.dir,
        onlyFiles: true,
        absolute: true,
        dot: true,
        ignore: [...this.absoluteIgnore, ...shielded],
      })
      .filter((f) => {
        const name = baseName(f);
        return !isSpecFile(name, this.specFilePattern) && !name.startsWith("_");
      })
      .map((file) => ({ path: file, files: [file] }));
  }

  /** Collects a cohort directory's member files, sorted, minus specs, templates, and shielded paths. */
  private collectMembers(dir: string, shielded: string[]): string[] {
    return fg
      .sync("**/*", {
        cwd: dir,
        onlyFiles: true,
        absolute: true,
        dot: true,
        ignore: [...this.absoluteIgnore, ...shielded],
      })
      .filter((f) => {
        const name = baseName(f);
        return !isSpecFile(name, this.specFilePattern) && !name.startsWith("_");
      })
      .sort();
  }

  /**
   * Discovers validation domains by scanning source directories.
   *
   * For each spec file found, checks for an optional `paths` frontmatter
   * field. When present, the glob patterns are expanded against the project
   * root to build an explicit target file list. Otherwise the spec validates
   * sibling files in its own directory.
   */
  private discoverValidationDomains(): ValidationDomain[] {
    const domains: ValidationDomain[] = [];

    for (const source of this.sources) {
      const sourceAbsPath = joinPath(this.root, source);
      const specPaths = fg.sync(`**/${this.specFilePattern}`, {
        cwd: sourceAbsPath,
        onlyFiles: true,
        absolute: true,
        dot: true,
      });

      for (const specPath of specPaths) {
        const dir = parentDir(specPath);
        const type = relativePath(this.root, dir) || baseName(dir);

        const fm = Frontmatter.fromFile(specPath);
        const pathPatterns = fm.array("paths") as string[];
        const cohort = this.readCohort(fm, specPath);
        const excludes = (fm.array("excludes") as string[]).map((p) => joinPath(this.root, p));
        const exemplars = (fm.array("exemplars") as string[]).map((p) => joinPath(this.root, p));
        // Exemplars are shielded from adverse judgment exactly like
        // excludes; they reach the judge only as inlined positives.
        const shielded = [...this.absoluteIgnore, ...excludes, ...exemplars];

        if (cohort === "by_directory") {
          const targetDirs = fg
            .sync(pathPatterns, {
              cwd: this.root,
              onlyDirectories: true,
              absolute: true,
              dot: true,
              ignore: shielded,
            })
            .sort();

          domains.push({ dir, specPath, type, cohort, excludes, exemplars, targetDirs });
        } else if (pathPatterns.length > 0) {
          const targetFiles = fg
            .sync(pathPatterns, {
              cwd: this.root,
              onlyFiles: true,
              absolute: true,
              dot: true,
              ignore: shielded,
            })
            .filter((f) => {
              const name = baseName(f);
              return !isSpecFile(name, this.specFilePattern) && !name.startsWith("_");
            });

          domains.push({ dir, specPath, type, cohort, excludes, exemplars, targetFiles });
        } else {
          domains.push({ dir, specPath, type, cohort, excludes, exemplars });
        }
      }
    }

    return domains;
  }

  /**
   * Reads and validates a spec's `cohort:` frontmatter value.
   *
   * @throws PraxisError when the value is outside the two-member enum
   */
  private readCohort(fm: Frontmatter, specPath: string): CohortMode {
    const raw = fm.value("cohort");

    if (raw === undefined || raw === null) {
      return "by_file";
    }

    if (typeof raw === "string" && (COHORT_MODES as string[]).includes(raw)) {
      return raw as CohortMode;
    }

    const shown = typeof raw === "string" ? raw : JSON.stringify(raw);
    throw errors.invalidCohortValue(shown, relativePath(this.root, specPath));
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
    const index = this.validatedCount;
    const total = this.totalToValidate;
    const counter = chalk.dim(`[${index}/${total}]`);
    const isCohort = unit.files.length > 1 || unit.files[0] !== unit.path;
    const cohortLabel = isCohort ? ` ${chalk.dim(`(cohort · ${unit.files.length} files)`)}` : "";
    const judgeLabel =
      this.judges.length > 1 ? ` ${chalk.cyan(`[judge: ${judgeConfig.name}]`)}` : "";

    this.out.lines(["", `${counter} ${chalk.bold(baseName(unit.path))}${cohortLabel}${judgeLabel}`]);

    try {
      const judge = new Judge({
        targetPath: unit.path,
        targetContent: isCohort ? this.assembleCohort(unit) : undefined,
        kind: isCohort ? "cohort" : "file",
        specPath,
        specFilePattern: this.specFilePattern,
        useCache: this.useCache,
        cacheManager: this.cacheManagers[judgeIndex] ?? undefined,
        judge: judgeConfig,
        root: this.root,
      });

      const result = await judge.validate();

      if (judge.cacheHit) {
        this.cacheStats.hits++;
      } else {
        this.cacheStats.misses++;
      }

      const batchResult: TargetVerdict = {
        ...result,
        path: unit.path,
        type,
        filename: baseName(unit.path),
        judge: judgeConfig.name,
      };

      if (result.compliant) {
        this.out.line(`\t${chalk.green("✓ PASS")}`);
      } else {
        const warning = result.severity === "warning";
        this.out.lines([
          `\t${warning ? chalk.yellow("⚠ WARN") : chalk.red("✗ FAIL")}`,
          ...result.issues.map((issue) => `\t${chalk.dim("·")} ${issue}`),
        ]);
      }

      this.results.push(batchResult);
    } catch (err) {
      this.out.lines([
        `\t${chalk.red("✗ ERROR")}`,
        `\t${chalk.dim("·")} ${(err as Error).message}`,
      ]);
      this.results.push({
        path: unit.path,
        type,
        filename: baseName(unit.path),
        judge: judgeConfig.name,
        compliant: false,
        severity: "error",
        issues: [`Validation failed: ${(err as Error).message}`],
        reason: (err as Error).message,
      });
    }
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
