import type { Command } from "commander";

import type { JudgeConfig } from "@/core/config.js";
import type { EvalSummary } from "@/eval/batch-judge.js";
import type { Verdict } from "@/eval/cache-manager.js";

import chalk from "chalk";

import { PraxisConfig } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { exists } from "@/core/files.js";
import { Logger } from "@/core/logger.js";
import { Paths, resolvePath } from "@/core/paths.js";
import { BatchJudge } from "@/eval/batch-judge.js";
import { CacheManager } from "@/eval/cache-manager.js";
import { cacheIdentity } from "@/eval/judge-hash.js";
import { Judge } from "@/eval/judge.js";
import {
  buildReport,
  computeCurrentHash,
  displayReport as displayValidationReport,
} from "@/eval/report-formatter.js";

/** Options for `validate document`. */
interface DocumentOptions {
  spec?: string;
  judge?: string;
  verbose: boolean;
  cache: boolean;
}

/** Options for `validate all`. */
interface AllOptions {
  type?: string;
  judge?: string;
  verbose: boolean;
  failFast: boolean;
  cache: boolean;
}

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

/**
 * Registers the deprecated `praxis validate` command group.
 *
 * Every subcommand is an alias for its `praxis eval` equivalent, kept
 * for scripts and habits formed under v1. New usage belongs on `eval`.
 */
export function registerValidateCommand(program: Command): void {
  const validate = program
    .command("validate")
    .description("Deprecated alias for `praxis eval` — use `praxis eval run`");

  validate
    .command("document <path>")
    .description("Deprecated: use `praxis eval run <target>`")
    .option("--spec <path>", "path to spec file")
    .option("--verbose", "show full AI reasoning", false)
    .option("--no-cache", "disable the verdict cache")
    .action(async (path: string, options: DocumentOptions) => {
      const logger = new Logger();
      try {
        const result = await makeCommand().document(path, options);

        // Warnings exit 0, matching full runs: only errors are fatal.
        const failed = !result.compliant && result.severity === "error";
        process.exit(failed ? 1 : 0);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  validate
    .command("all")
    .description("Deprecated: use `praxis eval run`")
    .option("--type <type>", "only judge targets of this type")
    .option("--verbose", "show full AI reasoning", false)
    .option("--fail-fast", "stop on first error", false)
    .option("--no-cache", "disable the verdict cache")
    .action(async (options: AllOptions) => {
      const logger = new Logger();
      try {
        const summary = await makeCommand().all(options);
        process.exit(summary.errors === 0 ? 0 : 1);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  validate
    .command("ci")
    .description("Deprecated: use `praxis eval ci`")
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

  validate
    .command("report <path>")
    .description("Deprecated: use `praxis eval verdict <target>`")
    .option("--verbose", "show full AI reasoning", false)
    .action((path: string, options: { verbose: boolean }) => {
      const logger = new Logger();
      try {
        makeCommand().report(path, options);
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
export class EvalCommand {
  private readonly root: string;
  private readonly config: PraxisConfig;

  constructor({ root, config }: { root: string; config?: PraxisConfig }) {
    this.root = root;
    this.config = config ?? new PraxisConfig(root);
  }

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

    console.log(`Validating ${path}...`);

    let worst: Verdict | null = null;

    for (const judgeConfig of judges) {
      const judge = new Judge({
        targetPath: path,
        specPath: options.spec,
        specFilePattern: this.config.specFilePattern,
        useCache: options.cache,
        cacheManager: this.cacheManagerFor(judgeConfig, options.cache),
        judge: judgeConfig,
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

    const batch = new BatchJudge({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      failFast: options.failFast,
      useCache: options.cache,
      judges,
      specFilePattern: this.config.specFilePattern,
    });

    if (options.type) {
      console.log(`Validating all ${options.type} documents...`);
      await batch.validateType(options.type);
    } else {
      console.log("Validating all documents...");
      await batch.validateAll();
    }

    if (batch.stopped) {
      console.log();
      console.log(chalk.yellow("[STOPPED]") + " Validation stopped early due to --fail-fast");
    }

    const summary = batch.summary();
    this.displaySummary(summary);

    if (options.cache) {
      console.log();
      console.log(
        chalk.blue("[CACHE]") +
          ` Hits: ${batch.cacheStats.hits}, Misses: ${batch.cacheStats.misses}`,
      );
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

    const batch = new BatchJudge({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      judges,
      specFilePattern: this.config.specFilePattern,
    });

    console.log("Running CI validation...");
    await batch.validateAll();

    const summary = batch.summary();
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

    for (const judge of judges) {
      const manager = new CacheManager({ projectRoot: this.root, judge: cacheIdentity(judge) });

      if (judges.length > 1) {
        console.log(`\n${chalk.cyan(`Judge: ${judge.name}`)}`);
      }

      const cacheData = manager.readRaw({ targetPath: absolutePath });

      // Use spec_path from cache if available, otherwise auto-detect
      const specPath = cacheData?.document.spec_path ?? undefined;
      const currentHash = computeCurrentHash(absolutePath, specPath, this.config.specFilePattern);

      const report = buildReport(absolutePath, cacheData, currentHash);
      displayValidationReport(report, options.verbose);
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
    if (result.compliant) {
      console.log(`${chalk.green("[PASS]")} ${path}`);
    } else if (result.severity === "warning") {
      console.log(`${chalk.yellow("[WARN]")} ${path}`);
      result.issues.forEach((issue) => console.log(`  - ${issue}`));
    } else {
      console.log(`${chalk.red("[FAIL]")} ${path}`);
      result.issues.forEach((issue) => console.log(`  - ${issue}`));
    }

    if (verbose) {
      console.log(`\nReasoning:\n${result.reason}`);
    }
  }

  /** Prints the aggregated validation summary. */
  private displaySummary(summary: EvalSummary): void {
    console.log();
    console.log("=".repeat(50));
    console.log("Summary");
    console.log("=".repeat(50));
    console.log(`Total documents: ${summary.total}`);
    console.log(`${chalk.green("[Compliant]")} ${summary.compliant}`);
    console.log(`${chalk.yellow("[Warnings]")} ${summary.warnings}`);
    console.log(`${chalk.red("[Errors]")} ${summary.errors}`);

    if (summary.notValidated > 0) {
      console.log(`${chalk.gray("[Not Validated]")} ${summary.notValidated} (no spec found)`);
    }

    console.log();
    console.log("By type:");
    for (const [type, stats] of Object.entries(summary.byType)) {
      console.log(`  ${type}: ${stats.compliant}/${stats.total} compliant`);
    }

    // Judges are separate instruments — with more than one, their
    // series render separately and are never pooled into one number.
    const judgeNames = Object.keys(summary.byJudge);

    if (judgeNames.length > 1) {
      console.log();
      console.log("By judge:");

      for (const name of judgeNames) {
        const stats = summary.byJudge[name];
        console.log(
          `  ${name}: ${chalk.green(String(stats.compliant))} pass, ${chalk.yellow(String(stats.warnings))} warn, ${chalk.red(String(stats.errors))} fail`,
        );
      }
    }
  }
}
