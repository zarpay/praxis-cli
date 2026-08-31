import type { Command } from "commander";

import type {
  AllOptions,
  DisplayEntry,
  DocumentOptions,
  EvalSummary,
  JudgeConfig,
  Verdict,
} from "@/types.js";

import chalk from "chalk";

import { PraxisProjectBase } from "@/core/base.js";
import { errors } from "@/core/errors.js";
import { exists } from "@/core/files.js";
import { Logger } from "@/core/logger.js";
import { Paths, resolvePath } from "@/core/paths.js";
import { CacheManager } from "@/eval/cache-manager.js";
import { EvalRun } from "@/eval/eval-run.js";
import { cacheIdentity } from "@/eval/judge-hash.js";
import { Judge } from "@/eval/judge.js";
import { VerdictReporter } from "@/eval/verdict-reporter.js";

/**
 * Registers the `praxis eval` command group.
 *
 * Provides subcommands for judging targets against their specs via
 * the OpenRouter API. Family rule: `eval run` writes (invokes judges);
 * every other subcommand reads existing results. The wiring here only
 * parses arguments, constructs EvalCommand, and maps results to exit
 * codes; all behavior lives on the class.
 */
export function registerEvalCommand(program: Command): void {
  const evalCmd = program.command("eval").description("Judge targets against their specs");

  evalCmd
    .command("run [targets...]")
    .description("Judge targets against their specs (no targets = full run)")
    .option("--type <type>", "only judge targets of this type (full run only)")
    .option("--judge <name>", "run only the named judge (default: all configured judges)")
    .option("--spec <path>", "path to spec file (single target only)")
    .option("--verbose", "show full AI reasoning", false)
    .option("--fail-fast", "stop on first error (full run only)", false)
    .option("--no-cache", "disable the verdict cache")
    .action(async (targets: string[], options: AllOptions & { spec?: string }) => {
      const logger = new Logger();
      try {
        const summary = await makeCommand().run(targets, options);
        process.exit(summary.errors === 0 ? 0 : 1);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  evalCmd
    .command("ci")
    .description("Run a full evaluation in CI mode")
    .option("--strict", "fail on warnings too", false)
    .action(async (options: { strict: boolean }) => {
      const logger = new Logger();
      try {
        const summary = await makeCommand().ci();

        if (options.strict) {
          process.exit(summary.errors === 0 && summary.warnings === 0 ? 0 : 1);
        } else {
          process.exit(summary.errors === 0 ? 0 : 1);
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  evalCmd
    .command("verdict <target>")
    .description("Show the cached verdict for a target, without an API call")
    .option("--verbose", "show full AI reasoning", false)
    .action((target: string, options: { verbose: boolean }) => {
      const logger = new Logger();
      try {
        makeCommand().report(target, options);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/** Orders verdicts for worst-of aggregation: pass < warning < error. */
function severityRank(verdict: Verdict): number {
  if (verdict.compliant) return 0;

  return verdict.severity === "warning" ? 1 : 2;
}

/** Builds an EvalCommand for the current project. */
function makeCommand(): EvalCommand {
  return new EvalCommand({ root: new Paths().root });
}

/**
 * Judges targets against their specs and reports results.
 *
 * One method per operation (run, document, all, ci, report). Methods
 * print their results to stdout and return the underlying data;
 * exit-code decisions belong to the command wiring, and configuration
 * problems are thrown as PraxisError.
 */
export class EvalCommand extends PraxisProjectBase {

  /**
   * The `eval run` entry point: judges the given targets, or performs
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
        judge: options.judge,
        verbose: options.verbose,
        cache: options.cache,
      });

      if (!result.compliant && result.severity === "error") errors++;

      if (!result.compliant && result.severity === "warning") warnings++;
    }
    return { errors, warnings };
  }

  /**
   * Judges a single target against its spec — once per configured judge.
   *
   * @returns The worst verdict across judges (the caller maps it to an
   *   exit code): any error wins over any warning wins over pass
   * @throws PraxisError when no judges are configured or a key is missing
   */
  async document(path: string, options: DocumentOptions): Promise<Verdict> {
    const judges = this.requireJudges(options.judge);

    this.out.line(`Validating ${path}...`);

    let worst: Verdict | null = null;

    for (const judgeConfig of judges) {
      const judge = new Judge({
        targetPath: path,
        specPath: options.spec,
        specFilePattern: this.config.specFilePattern,
        useCache: options.cache,
        cacheManager: this.cacheManagerFor(judgeConfig, options.cache),
        config: judgeConfig,
        root: this.root,
      });

      const result = await judge.validate();
      const label =
        judges.length > 1 ? `${path} ${chalk.cyan(`[judge: ${judgeConfig.name}]`)}` : path;
      this.displayResult(label, result, options.verbose);

      if (!worst || severityRank(result) > severityRank(worst)) {
        worst = result;
      }
    }

    // requireJudges guarantees at least one judge, hence one verdict.
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
    const judges = this.requireJudges(options.judge);

    const run = new EvalRun({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      failFast: options.failFast,
      useCache: options.cache,
      judges,
      specFilePattern: this.config.specFilePattern,
    });

    if (options.type) {
      this.out.line(`Validating all ${options.type} documents...`);
      await run.validateType(options.type);
    } else {
      this.out.line("Validating all documents...");
      await run.validateAll();
    }

    if (run.stopped) {
      this.out.print([
        "",
        { badge: "STOPPED", color: "yellow", value: "Validation stopped early due to --fail-fast" },
      ]);
    }

    const summary = run.summary();
    this.displaySummary(summary);

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

    return summary;
  }

  /**
   * Validates all documents for CI, printing progress and a summary.
   *
   * @returns The aggregated summary (the caller applies strictness)
   * @throws PraxisError when validation config or the API key is missing
   */
  async ci(): Promise<EvalSummary> {
    const judges = this.requireJudges();

    const run = new EvalRun({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      judges,
      specFilePattern: this.config.specFilePattern,
    });

    this.out.line("Running CI validation...");
    await run.validateAll();

    const summary = run.summary();
    this.displaySummary(summary);

    return summary;
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

    // Reading needs no API keys, but it does need the configured judges
    // to know which cache namespaces to read.
    const judges = this.config.judges;

    if (judges.length === 0) {
      throw errors.missingJudges();
    }

    const reporter = new VerdictReporter({
      specFilePattern: this.config.specFilePattern,
      root: this.root,
    });

    for (const judge of judges) {
      const manager = new CacheManager({ projectRoot: this.root, judge: cacheIdentity(judge) });

      if (judges.length > 1) {
        this.out.print(["", { text: `Judge: ${judge.name}`, color: "cyan" }]);
      }

      const cacheData = manager.readRaw({ targetPath: absolutePath });
      reporter.render(reporter.build(absolutePath, cacheData), options.verbose);
    }
  }

  /**
   * Returns the configured judges after checking every judge's API key
   * environment variable is set.
   *
   * @throws PraxisError with setup guidance when no judges are
   *   configured or any judge's key is missing
   */
  private requireJudges(only?: string): JudgeConfig[] {
    const configured = this.config.judges;

    if (configured.length === 0) {
      throw errors.missingJudges();
    }

    const judges = only ? configured.filter((judge) => judge.name === only) : configured;

    if (judges.length === 0) {
      throw errors.unknownJudge(
        only!,
        configured.map((judge) => judge.name),
      );
    }

    for (const judge of judges) {
      const key = process.env[judge.apiKeyEnvVar];

      if (!key || key.length === 0) {
        throw errors.missingApiKey(judge.apiKeyEnvVar);
      }
    }

    return judges;
  }

  /** A judge-namespaced CacheManager, or undefined when caching is disabled. */
  private cacheManagerFor(judge: JudgeConfig, useCache: boolean): CacheManager | undefined {
    if (!useCache) return undefined;

    return new CacheManager({ projectRoot: this.root, judge: cacheIdentity(judge) });
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
    // Judges are separate instruments — with more than one, their
    // series render separately and are never pooled into one number.
    const judgeNames = Object.keys(summary.byJudge);

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
      ...(judgeNames.length > 1
        ? [
            "",
            "By judge:",
            ...judgeNames.map((name) => {
              const stats = summary.byJudge[name];
              return `  ${name}: ${chalk.green(String(stats.compliant))} pass, ${chalk.yellow(String(stats.warnings))} warn, ${chalk.red(String(stats.errors))} fail`;
            }),
          ]
        : []),
    ]);
  }
}
