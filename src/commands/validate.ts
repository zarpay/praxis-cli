import type { Command } from "commander";

import chalk from "chalk";

import { DEFAULT_SPEC_FILE_PATTERN, PraxisConfig, type ValidationConfig } from "@/core/config.js";
import { errors } from "@/core/errors.js";
import { exists } from "@/core/files.js";
import { Logger } from "@/core/logger.js";
import { Paths, resolvePath } from "@/core/paths.js";
import { BatchValidator, type ValidationSummary } from "@/validator/batch-validator.js";
import { type CachedValidationResult, CacheManager } from "@/validator/cache-manager.js";
import { DocumentValidator } from "@/validator/document-validator.js";
import {
  buildReport,
  computeCurrentHash,
  displayReport as displayValidationReport,
} from "@/validator/report-formatter.js";

/** Options for `validate document`. */
interface DocumentOptions {
  spec?: string;
  verbose: boolean;
  cache: boolean;
}

/** Options for `validate all`. */
interface AllOptions {
  type?: string;
  verbose: boolean;
  failFast: boolean;
  cache: boolean;
}

/**
 * Registers the `praxis validate` command group.
 *
 * Provides subcommands for AI-powered document validation against
 * spec files via the OpenRouter API. The wiring here only parses
 * arguments, constructs ValidateCommand, and maps results to exit
 * codes; all behavior lives on the class.
 */
export function registerValidateCommand(program: Command): void {
  const validate = program
    .command("validate")
    .description("Validate documents against their specifications");

  validate
    .command("document <path>")
    .description("Validate a single document")
    .option("--spec <path>", "path to specification file")
    .option("--verbose", "show full AI reasoning", false)
    .option("--no-cache", "disable validation cache")
    .action(async (path: string, options: DocumentOptions) => {
      const logger = new Logger();
      try {
        const result = await makeCommand().document(path, options);

        // Warnings exit 0, matching `validate all`: only errors are fatal.
        const failed = !result.compliant && result.severity === "error";
        process.exit(failed ? 1 : 0);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  validate
    .command("all")
    .description("Validate all documents")
    .option("--type <type>", "only validate documents of this type")
    .option("--verbose", "show full AI reasoning", false)
    .option("--fail-fast", "stop on first error", false)
    .option("--no-cache", "disable validation cache")
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
    .description("Run validation in CI mode")
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
    .description("Show cached validation status for a document")
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

/** Builds a ValidateCommand for the current project. */
function makeCommand(): ValidateCommand {
  return new ValidateCommand({ root: new Paths().root });
}

/**
 * Runs document validation against specs and reports results.
 *
 * One method per subcommand (document, all, ci, report). Methods print
 * their results to stdout and return the underlying data; exit-code
 * decisions belong to the command wiring, and configuration problems
 * are thrown as PraxisError.
 */
export class ValidateCommand {
  private readonly root: string;
  private readonly config: PraxisConfig;

  constructor({ root, config }: { root: string; config?: PraxisConfig }) {
    this.root = root;
    this.config = config ?? new PraxisConfig(root);
  }

  /**
   * Validates a single document against its spec.
   *
   * @returns The validation result (the caller maps it to an exit code)
   * @throws PraxisError when validation config or the API key is missing
   */
  async document(path: string, options: DocumentOptions): Promise<CachedValidationResult> {
    const validation = this.requireValidationConfig();

    console.log(`Validating ${path}...`);

    const validator = new DocumentValidator({
      documentPath: path,
      specPath: options.spec,
      specFilePattern: this.specFilePattern(validation),
      useCache: options.cache,
      cacheManager: this.cacheManager(options.cache),
      apiKeyEnvVar: validation.apiKeyEnvVar,
      model: validation.model,
    });

    const result = await validator.validate();
    this.displayResult(path, result, options.verbose);

    return result;
  }

  /**
   * Validates all documents (optionally scoped to one type) and prints
   * per-document progress, a summary, and cache statistics.
   *
   * @returns The aggregated summary (the caller maps it to an exit code)
   * @throws PraxisError when validation config or the API key is missing
   */
  async all(options: AllOptions): Promise<ValidationSummary> {
    const validation = this.requireValidationConfig();

    const batch = new BatchValidator({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      failFast: options.failFast,
      useCache: options.cache,
      cacheManager: this.cacheManager(options.cache),
      apiKeyEnvVar: validation.apiKeyEnvVar,
      model: validation.model,
      specFilePattern: this.specFilePattern(validation),
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
  async ci(): Promise<ValidationSummary> {
    const validation = this.requireValidationConfig();

    const batch = new BatchValidator({
      root: this.root,
      sources: this.config.sources,
      ignore: this.config.ignore,
      apiKeyEnvVar: validation.apiKeyEnvVar,
      model: validation.model,
      specFilePattern: this.specFilePattern(validation),
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

    const cacheManager = new CacheManager(undefined, this.root);
    const specFilePattern = this.config.validation?.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;
    const cacheData = cacheManager.readRaw({ documentPath: absolutePath });

    // Use spec_path from cache if available, otherwise auto-detect
    const specPath = cacheData?.document.spec_path ?? undefined;
    const currentHash = computeCurrentHash(absolutePath, specPath, specFilePattern);

    const report = buildReport(absolutePath, cacheData, currentHash);
    displayValidationReport(report, options.verbose);
  }

  /**
   * Returns the validation config after checking it is complete and
   * the API key environment variable is set.
   *
   * @throws PraxisError with setup guidance when either is missing
   */
  private requireValidationConfig(): ValidationConfig {
    const validation = this.config.validation;
    if (!validation?.apiKeyEnvVar || !validation.model) {
      throw errors.missingValidationConfig();
    }

    const key = process.env[validation.apiKeyEnvVar];
    if (!key || key.length === 0) {
      throw errors.missingApiKey(validation.apiKeyEnvVar);
    }

    return validation;
  }

  /** The spec file pattern from validation config, or the default. */
  private specFilePattern(validation: ValidationConfig): string {
    return validation.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;
  }

  /** A project-rooted CacheManager, or undefined when caching is disabled. */
  private cacheManager(useCache: boolean): CacheManager | undefined {
    return useCache ? new CacheManager(undefined, this.root) : undefined;
  }

  /** Prints a single validation result with colored status. */
  private displayResult(path: string, result: CachedValidationResult, verbose: boolean): void {
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
  private displaySummary(summary: ValidationSummary): void {
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
  }
}
