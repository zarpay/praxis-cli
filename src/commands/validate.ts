import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { Command } from "commander";

import chalk from "chalk";

import { DEFAULT_SPEC_FILE_PATTERN, PraxisConfig, type ValidationConfig } from "@/core/config.js";
import { Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";
import {
  BatchValidator,
  type BatchValidationResult,
  type ValidationSummary,
} from "@/validator/batch-validator.js";
import { CacheManager } from "@/validator/cache-manager.js";
import { DocumentValidator } from "@/validator/document-validator.js";
import {
  buildReport,
  computeCurrentHash,
  displayReport as displayValidationReport,
} from "@/validator/report-formatter.js";

/**
 * Registers the `praxis validate` command group.
 *
 * Provides subcommands for AI-powered document validation
 * against directory README specifications via the OpenRouter API.
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
    .action(async (path: string, options: { spec?: string; verbose: boolean; cache: boolean }) => {
      const logger = new Logger();

      try {
        const paths = new Paths();
        const config = new PraxisConfig(paths.root);
        const validation = requireValidationConfig(config, logger);
        checkApiKey(validation.apiKeyEnvVar, logger);

        const cacheManager = options.cache ? new CacheManager(undefined, paths.root) : undefined;
        const specFilePattern = validation.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;

        console.log(`Validating ${path}...`);

        const validator = new DocumentValidator({
          documentPath: path,
          specPath: options.spec,
          specFilePattern,
          useCache: options.cache,
          cacheManager,
          apiKeyEnvVar: validation.apiKeyEnvVar,
          model: validation.model,
        });

        const result = await validator.validate();
        displayResult(path, result, options.verbose);

        process.exit(result.compliant ? 0 : 1);
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
    .option("--fail-fast", "stop on first error", true)
    .option("--no-cache", "disable validation cache")
    .action(
      async (options: {
        type?: string;
        verbose: boolean;
        failFast: boolean;
        cache: boolean;
      }) => {
        const logger = new Logger();

        try {
          const paths = new Paths();
          const config = new PraxisConfig(paths.root);
          const validation = requireValidationConfig(config, logger);
          checkApiKey(validation.apiKeyEnvVar, logger);

          const cacheManager = options.cache ? new CacheManager(undefined, paths.root) : undefined;
          const specFilePattern = validation.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;

          const batch = new BatchValidator({
            root: paths.root,
            sources: config.sources,
            failFast: options.failFast,
            useCache: options.cache,
            cacheManager,
            apiKeyEnvVar: validation.apiKeyEnvVar,
            model: validation.model,
            specFilePattern,
          });

          let results: BatchValidationResult[];

          if (options.type) {
            console.log(`Validating all ${options.type} documents...`);
            results = await batch.validateType(options.type);
          } else {
            console.log("Validating all documents...");
            results = await batch.validateAll();
          }

          displayBatchResults(results);

          if (batch.stopped) {
            console.log();
            console.log(chalk.yellow("[STOPPED]") + " Validation stopped early due to --fail-fast");
          }

          displaySummary(batch.summary());

          if (options.cache) {
            console.log();
            console.log(
              chalk.blue("[CACHE]") +
                ` Hits: ${batch.cacheStats.hits}, Misses: ${batch.cacheStats.misses}`,
            );
          }

          process.exit(batch.summary().errors === 0 ? 0 : 1);
        } catch (err) {
          logger.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      },
    );

  validate
    .command("ci")
    .description("Run validation in CI mode")
    .option("--strict", "fail on warnings too", false)
    .action(async (options: { strict: boolean }) => {
      const logger = new Logger();

      try {
        const paths = new Paths();
        const config = new PraxisConfig(paths.root);
        const validation = requireValidationConfig(config, logger);
        checkApiKey(validation.apiKeyEnvVar, logger);

        const specFilePattern = validation.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;

        const batch = new BatchValidator({
          root: paths.root,
          sources: config.sources,
          apiKeyEnvVar: validation.apiKeyEnvVar,
          model: validation.model,
          specFilePattern,
        });

        console.log("Running CI validation...");
        await batch.validateAll();

        const summary = batch.summary();
        displaySummary(summary);

        if (options.strict) {
          process.exit(summary.compliant === summary.total ? 0 : 1);
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
    .action(async (path: string, options: { verbose: boolean }) => {
      const logger = new Logger();

      try {
        const paths = new Paths();
        const cacheManager = new CacheManager(undefined, paths.root);

        const absolutePath = resolve(path);

        if (!existsSync(absolutePath)) {
          logger.error(`Document not found: ${path}`);
          process.exit(1);
        }

        const config = new PraxisConfig(paths.root);
        const specFilePattern = config.validation?.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;
        const cacheData = cacheManager.readRaw({ documentPath: absolutePath });

        // Use spec_path from cache if available, otherwise auto-detect
        const specPath = cacheData?.document.spec_path ?? undefined;
        const currentHash = computeCurrentHash(absolutePath, specPath, specFilePattern);

        const report = buildReport(absolutePath, cacheData, currentHash);
        displayValidationReport(report, options.verbose);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Reads validation config from PraxisConfig and returns it.
 *
 * Exits with a helpful error message if the validation section
 * is missing or incomplete in the config.
 */
function requireValidationConfig(config: PraxisConfig, logger: Logger): ValidationConfig {
  const validation = config.validation;
  if (!validation || !validation.apiKeyEnvVar || !validation.model) {
    logger.error("Missing validation configuration in .praxis/config.json");
    logger.error("");
    logger.error("Add a 'validation' section to your config:");
    logger.error('  "validation": {');
    logger.error('    "apiKeyEnvVar": "OPENROUTER_API_KEY",');
    logger.error('    "model": "x-ai/grok-4.1-fast"');
    logger.error("  }");
    logger.error("");
    process.exit(1);
  }
  return validation;
}

/**
 * Checks that the required API key environment variable is set.
 *
 * Prints setup instructions and exits if the key is missing.
 */
function checkApiKey(envVarName: string, logger: Logger): void {
  const key = process.env[envVarName];
  if (key && key.length > 0) return;

  logger.error(`Missing ${envVarName} environment variable`);
  logger.error("");
  logger.error("To use document validation, you need an OpenRouter API key:");
  logger.error("  1. Get a key at https://openrouter.ai/keys");
  logger.error(`  2. Set it: export ${envVarName}=your-key-here`);
  logger.error("");
  process.exit(1);
}

/**
 * Displays a single validation result with colored status.
 */
function displayResult(
  path: string,
  result: { compliant: boolean; severity?: string; issues: string[]; reason: string },
  verbose: boolean,
): void {
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

/**
 * Displays all results from a batch validation run.
 */
function displayBatchResults(results: BatchValidationResult[]): void {
  console.log();
  for (const result of results) {
    if (result.compliant) {
      console.log(`${chalk.green("[PASS]")} ${result.filename}`);
    } else if (result.severity === "warning") {
      console.log(`${chalk.yellow("[WARN]")} ${result.filename}`);
    } else {
      console.log(`${chalk.red("[FAIL]")} ${result.filename}`);
      result.issues.forEach((issue) => console.log(`    ${issue}`));
    }
  }
}

/**
 * Displays the aggregated validation summary.
 */
function displaySummary(summary: ValidationSummary): void {
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
