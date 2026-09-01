import type { Command } from "commander";

import type { EvalSummary, Verdict } from "@/domains/eval/types.js";
import type { DiscoveryScope, EvalProgress } from "@/domains/eval/types.js";
import type { AllOptions, DocumentOptions } from "@/domains/workspace/types.js";
import type { DisplayEntry, ReviewerConfig } from "@/types.js";

import chalk from "chalk";

import { runAction } from "@/commands/action.js";
import { PraxisProjectBase } from "@/commands/base.js";
import { errors } from "@/core/errors.js";
import { exists } from "@/core/files.js";
import { joinPath, resolvePath } from "@/core/paths.js";
import { ReviewSubject } from "@/domains/eval/models/review-subject.js";
import { Reviewer } from "@/domains/eval/models/reviewer.js";
import runEval from "@/domains/eval/orchestrators/run-eval.js";
import cacheIdentity from "@/domains/eval/services/build-cache-identity.js";
import reviewTarget from "@/domains/eval/services/review-target.js";
import { CacheManager } from "@/domains/eval/services/verdict-cache.js";
import { unitHeading, verdictMark } from "@/domains/eval/views/progress.js";
import { VerdictReporter } from "@/domains/eval/views/verdict-report.js";
import { Paths } from "@/domains/workspace/models/project-paths.js";

/**
 * Registers the `praxis eval` command group.
 *
 * Provides subcommands for reviewing targets against their specs via
 * the OpenRouter API. Family rule: `eval run` writes (invokes reviewers);
 * every other subcommand reads existing results. The wiring here only
 * parses arguments, constructs EvalCommand, and maps results to exit
 * codes; all behavior lives on the class.
 */
export function registerEvalCommand(program: Command): void {
  const evalCmd = program.command("eval").description("Reviewer targets against their specs");

  evalCmd
    .command("run [targets...]")
    .description("Reviewer targets against their specs (no targets = full run)")
    .option("--type <type>", "only reviewer targets of this type (full run only)")
    .option("--reviewer <name>", "run only the named reviewer (default: all configured reviewers)")
    .option("--spec <path>", "path to spec file (single target only)")
    .option("--verbose", "show full AI reasoning", false)
    .option("--fail-fast", "stop on first error (full run only)", false)
    .option("--no-cache", "disable the verdict cache")
    .action((targets: string[], options: AllOptions & { spec?: string }) =>
      runAction(async () => {
        const summary = await makeCommand().run(targets, options);
        return summary.errors === 0 ? 0 : 1;
      }),
    );

  evalCmd
    .command("ci")
    .description("Run a full review in CI mode")
    .option("--strict", "fail on warnings too", false)
    .action((options: { strict: boolean }) =>
      runAction(async () => {
        const summary = await makeCommand().ci();
        const failures = summary.errors + (options.strict ? summary.warnings : 0);
        return failures === 0 ? 0 : 1;
      }),
    );

  evalCmd
    .command("verdict <target>")
    .description("Show the cached verdict for a target, without an API call")
    .option("--verbose", "show full AI reasoning", false)
    .action((target: string, options: { verbose: boolean }) =>
      runAction(() => makeCommand().report(target, options)),
    );
}

/** Orders verdicts for worst-of aggregation: pass < warning < error. */
export function severityRank(verdict: Verdict): number {
  if (verdict.compliant) return 0;

  return verdict.severity === "warning" ? 1 : 2;
}

/** Builds an EvalCommand for the current project. */
function makeCommand(): EvalCommand {
  return new EvalCommand({ root: new Paths().root });
}

/**
 * Reviewers targets against their specs and reports results.
 *
 * One method per operation (run, document, all, ci, report). Methods
 * print their results to stdout and return the underlying data;
 * exit-code decisions belong to the command wiring, and configuration
 * problems are thrown as PraxisError.
 */
export class EvalCommand extends PraxisProjectBase {
  /**
   * The `eval run` entry point: reviews the given targets, or performs
   * a full run over every spec-covered target when none are given.
   *
   * @returns An aggregated summary (the caller maps it to an exit code)
   * @throws PraxisError when validation config or the API key is missing
   */
  async run(
    targets: string[],
    options: AllOptions & { spec?: string },
  ): Promise<{ errors: number; warnings: number }> {
    if (targets.length === 0) {
      return this.all(options);
    }

    let errors = 0;
    let warnings = 0;
    for (const target of targets) {
      const result = await this.document(target, {
        spec: targets.length === 1 ? options.spec : undefined,
        reviewer: options.reviewer,
        verbose: options.verbose,
        cache: options.cache,
      });

      if (!result.compliant && result.severity === "error") errors++;

      if (!result.compliant && result.severity === "warning") warnings++;
    }
    return { errors, warnings };
  }

  /**
   * Reviewers a single target against its spec — once per configured reviewer.
   *
   * @returns The worst verdict across reviewers (the caller maps it to an
   *   exit code): any error wins over any warning wins over pass
   * @throws PraxisError when no reviewers are configured or a key is missing
   */
  async document(path: string, options: DocumentOptions): Promise<Verdict> {
    const reviewers = this.requireReviewers(options.reviewer);

    this.out.line(`Validating ${path}...`);

    let worst: Verdict | null = null;

    const target = ReviewSubject.resolve({
      targetPath: path,
      specPath: options.spec,
      specFilePattern: this.config.specFilePattern,
      root: this.root,
    });

    for (const reviewerConfig of reviewers) {
      const { verdict: result } = await reviewTarget({
        target,
        reviewer: Reviewer.fromConfig(reviewerConfig),
        cache: this.cacheManagerFor(reviewerConfig, options.cache) ?? null,
        root: this.root,
      });

      const label =
        reviewers.length > 1 ? `${path} ${chalk.cyan(`[reviewer: ${reviewerConfig.name}]`)}` : path;
      this.displayResult(label, result, options.verbose);

      if (!worst || severityRank(result) > severityRank(worst)) {
        worst = result;
      }
    }

    // requireReviewers guarantees at least one reviewer, hence one verdict.
    return worst!;
  }

  /**
   * Validates all documents (optionally scoped to one type) and prints
   * per-document progress, a summary, and cache statistics.
   *
   * @returns The aggregated summary (the caller maps it to an exit code)
   * @throws PraxisError when validation config or the API key is missing
   */
  async all(options: AllOptions): Promise<EvalSummary> {
    const reviewers = this.requireReviewers(options.reviewer);

    this.out.line(
      options.type ? `Validating all ${options.type} documents...` : "Validating all documents...",
    );

    const run = await runEval({
      ...this.evalScope(),
      reviewers,
      type: options.type,
      failFast: options.failFast,
      useCache: options.cache,
      onProgress: (event) => this.renderProgress(event),
    });

    if (run.stoppedEarly) {
      this.out.print([
        "",
        { badge: "STOPPED", color: "yellow", value: "Validation stopped early due to --fail-fast" },
      ]);
    }

    this.displaySummary(run.summary);

    if (options.cache) {
      this.out.print([
        "",
        {
          badge: "CACHE",
          color: "blue",
          value: `Hits: ${run.cacheStats.hits}, Misses: ${run.cacheStats.misses}`,
        },
      ]);
    }

    return run.summary;
  }

  /**
   * Validates all documents for CI, printing progress and a summary.
   *
   * @returns The aggregated summary (the caller applies strictness)
   * @throws PraxisError when validation config or the API key is missing
   */
  async ci(): Promise<EvalSummary> {
    const reviewers = this.requireReviewers();

    this.out.line("Running CI validation...");

    const run = await runEval({
      ...this.evalScope(),
      reviewers,
      onProgress: (event) => this.renderProgress(event),
    });

    this.displaySummary(run.summary);

    return run.summary;
  }

  /**
   * Prints the cached validation status for a document, without any API call.
   *
   * @throws PraxisError if the document does not exist
   */
  report(path: string, options: { verbose: boolean }): void {
    const absolutePath = resolvePath(path);

    if (!exists(absolutePath)) {
      throw errors.documentNotFound(path);
    }

    // Reading needs no API keys, but it does need the configured reviewers
    // to know which cache namespaces to read.
    const reviewers = this.config.reviewers;

    if (reviewers.length === 0) {
      throw errors.missingReviewers();
    }

    const reporter = new VerdictReporter({
      specFilePattern: this.config.specFilePattern,
      root: this.root,
    });

    for (const reviewer of reviewers) {
      const manager = new CacheManager({
        projectRoot: this.root,
        reviewer: cacheIdentity(reviewer),
      });

      if (reviewers.length > 1) {
        this.out.print(["", { text: `Reviewer: ${reviewer.name}`, color: "cyan" }]);
      }

      const cacheData = manager.readRaw({ targetPath: absolutePath });
      reporter.render(reporter.build(absolutePath, cacheData), options.verbose);
    }
  }

  /** The project's discovery scope, as every run needs it. */
  private evalScope(): DiscoveryScope {
    return {
      root: this.root,
      sources: this.config.sources,
      specFilePattern: this.config.specFilePattern,
      absoluteIgnore: this.config.ignore.map((p) => joinPath(this.root, p)),
    };
  }

  /** Renders one run event as it happens. */
  private renderProgress(event: EvalProgress): void {
    if (event.kind === "unit-start") {
      this.out.print(["", unitHeading(event)]);
    } else if (event.kind === "verdict") {
      this.out.print([
        `\t${verdictMark(event.verdict)}`,
        ...(event.verdict.compliant
          ? []
          : event.verdict.issues.map((issue) => `\t${chalk.dim("·")} ${issue}`)),
      ]);
    } else {
      this.out.print([`\t${chalk.red("✗ ERROR")}`, `\t${chalk.dim("·")} ${event.message}`]);
    }
  }

  /**
   * Returns the configured reviewers after checking every reviewer's API key
   * environment variable is set.
   *
   * @throws PraxisError with setup guidance when no reviewers are
   *   configured or any reviewer's key is missing
   */
  private requireReviewers(only?: string): ReviewerConfig[] {
    const configured = this.config.reviewers;

    if (configured.length === 0) {
      throw errors.missingReviewers();
    }

    const reviewers = only ? configured.filter((reviewer) => reviewer.name === only) : configured;

    if (reviewers.length === 0) {
      throw errors.unknownReviewer(
        only!,
        configured.map((reviewer) => reviewer.name),
      );
    }

    for (const reviewer of reviewers) {
      const key = process.env[reviewer.apiKeyEnvVar];

      if (!key || key.length === 0) {
        throw errors.missingApiKey(reviewer.apiKeyEnvVar);
      }
    }

    return reviewers;
  }

  /** A reviewer-namespaced CacheManager, or undefined when caching is disabled. */
  private cacheManagerFor(reviewer: ReviewerConfig, useCache: boolean): CacheManager | undefined {
    if (!useCache) return undefined;

    return new CacheManager({ projectRoot: this.root, reviewer: cacheIdentity(reviewer) });
  }

  /** Prints a single validation result with colored status. */
  private displayResult(path: string, result: Verdict, verbose: boolean): void {
    this.out.print([
      this.resultBadge(path, result),
      ...(result.compliant ? [] : result.issues.map((issue) => `  - ${issue}`)),
      ...(verbose ? ["", "Reasoning:", result.reason] : []),
    ]);
  }

  /** The colored status badge entry for a single verdict line. */
  private resultBadge(path: string, result: Verdict): DisplayEntry {
    if (result.compliant) return { badge: "PASS", color: "green", value: path };

    if (result.severity === "warning") return { badge: "WARN", color: "yellow", value: path };

    return { badge: "FAIL", color: "red", value: path };
  }

  /** Prints the aggregated validation summary. */
  private displaySummary(summary: EvalSummary): void {
    // Reviewers are separate instruments — with more than one, their
    // series render separately and are never pooled into one number.
    const reviewerNames = Object.keys(summary.byReviewer);

    this.out.print([
      "",
      { header: "Summary" },
      `Total documents: ${summary.total}`,
      { badge: "Compliant", color: "green", value: summary.compliant },
      { badge: "Warnings", color: "yellow", value: summary.warnings },
      { badge: "Errors", color: "red", value: summary.errors },
      summary.notValidated > 0 && {
        badge: "Not Validated",
        color: "gray",
        value: `${summary.notValidated} (no spec found)`,
      },
      "",
      "By type:",
      ...Object.entries(summary.byType).map(
        ([type, stats]) => `  ${type}: ${stats.compliant}/${stats.total} compliant`,
      ),
      ...(reviewerNames.length > 1
        ? [
            "",
            "By reviewer:",
            ...reviewerNames.map((name) => {
              const stats = summary.byReviewer[name];
              return `  ${name}: ${chalk.green(String(stats.compliant))} pass, ${chalk.yellow(String(stats.warnings))} warn, ${chalk.red(String(stats.errors))} fail`;
            }),
          ]
        : []),
    ]);
  }
}
