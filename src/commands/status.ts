import { basename, join, relative, resolve } from "node:path";
import { existsSync } from "node:fs";

import type { Command } from "commander";
import chalk from "chalk";
import fg from "fast-glob";

import { Frontmatter } from "@/compiler/frontmatter.js";
import { GlobExpander } from "@/compiler/glob-expander.js";
import { DEFAULT_SPEC_FILE_PATTERN, PraxisConfig } from "@/core/config.js";
import { Logger } from "@/core/logger.js";
import { Paths } from "@/core/paths.js";
import { CacheManager } from "@/validator/cache-manager.js";
import { isSpecFile } from "@/validator/spec-pattern.js";

/** Structured report of project health. */
export interface StatusReport {
  counts: {
    roles: number;
    responsibilities: number;
    references: number;
    context: number;
  };
  validation: {
    pass: number;
    warn: number;
    fail: number;
    notValidated: number;
  };
  orphanedResponsibilities: string[];
  danglingRefs: { role: string; ref: string }[];
  rolesMissingDescription: string[];
  zeroMatchGlobs: { role: string; pattern: string }[];
  unmatchedOwners: { responsibility: string; owner: string }[];
}

/**
 * Registers the `praxis status` command.
 *
 * Performs static analysis of the project structure and reports
 * counts, orphaned files, dangling references, and other health issues.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show project health dashboard")
    .action(async () => {
      const logger = new Logger();
      try {
        const paths = new Paths();
        const config = new PraxisConfig(paths.root);
        const report = await analyzeProject(paths.root, config);
        displayReport(report, logger);

        const hasIssues =
          report.danglingRefs.length > 0 ||
          report.orphanedResponsibilities.length > 0 ||
          report.rolesMissingDescription.length > 0 ||
          report.zeroMatchGlobs.length > 0 ||
          report.unmatchedOwners.length > 0;

        if (hasIssues) {
          process.exitCode = 1;
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}

/**
 * Analyzes a Praxis project and returns a structured health report.
 *
 * Scans configured directories, checks cross-references between
 * roles and responsibilities, and identifies common issues.
 *
 * @param root - Project root directory
 * @param config - PraxisConfig instance
 */
export async function analyzeProject(root: string, config: PraxisConfig): Promise<StatusReport> {
  const specFilePattern = config.validation?.specFilePattern ?? DEFAULT_SPEC_FILE_PATTERN;
  const globExpander = new GlobExpander(root, specFilePattern);

  const absoluteIgnore = config.ignore.map((p) => resolve(root, p));

  // Count content files by type using config-driven paths
  const roleFiles = await listContentFiles(config.rolesDir, false, specFilePattern, absoluteIgnore);
  const respFiles = await listContentFiles(config.responsibilitiesDir, false, specFilePattern, absoluteIgnore);

  // Scan all sources for reference and context files by frontmatter type
  let references = 0;
  let contextCount = 0;
  for (const source of config.sources) {
    const sourceDir = resolve(root, source);
    const allFiles = await listContentFiles(sourceDir, true, specFilePattern, absoluteIgnore);
    for (const file of allFiles) {
      const fm = new Frontmatter(file);
      const type = fm.value("type") as string | undefined;
      if (type === "reference") references++;
      else if (type === "convention" || type === "constitution") contextCount++;
    }
  }

  // Build role alias map and check roles
  const roleAliases = new Map<string, string>();
  const allReferencedResps = new Set<string>();
  const danglingRefs: StatusReport["danglingRefs"] = [];
  const zeroMatchGlobs: StatusReport["zeroMatchGlobs"] = [];
  const rolesMissingDescription: string[] = [];

  for (const roleFile of roleFiles) {
    const fm = new Frontmatter(roleFile);
    const alias = fm.value("alias") as string | undefined;
    const roleName = basename(roleFile);

    if (alias) {
      roleAliases.set(alias.toLowerCase(), roleName);
    }

    if (!fm.value("description")) {
      rolesMissingDescription.push(roleName);
    }

    // Check all ref-type keys
    for (const key of ["responsibilities", "context", "refs"]) {
      const patterns = fm.array(key) as string[];

      for (const pattern of patterns) {
        if (globExpander.isGlob(pattern)) {
          const matches = await globExpander.expand(pattern);
          if (matches.length === 0) {
            zeroMatchGlobs.push({ role: roleName, pattern });
          }
          if (key === "responsibilities") {
            for (const m of matches) allReferencedResps.add(m);
          }
        } else {
          const fullPath = join(root, pattern);
          if (!existsSync(fullPath)) {
            danglingRefs.push({ role: roleName, ref: pattern });
          }
          if (key === "responsibilities") {
            allReferencedResps.add(pattern);
          }
        }
      }
    }
  }

  // Find orphaned responsibilities
  const orphanedResponsibilities: string[] = [];
  for (const respFile of respFiles) {
    const relPath = relative(root, respFile);
    if (!allReferencedResps.has(relPath)) {
      orphanedResponsibilities.push(basename(respFile));
    }
  }

  // Find unmatched owners
  const unmatchedOwners: StatusReport["unmatchedOwners"] = [];
  for (const respFile of respFiles) {
    const fm = new Frontmatter(respFile);
    const owner = fm.value("owner") as string | undefined;
    if (owner && !roleAliases.has(owner.toLowerCase())) {
      unmatchedOwners.push({ responsibility: basename(respFile), owner });
    }
  }

  // Scan cached validation results for all source documents
  const cacheManager = new CacheManager(undefined, root);
  const allSourceFiles = await listAllSourceFiles(root, config.sources, specFilePattern, absoluteIgnore);
  const validation = { pass: 0, warn: 0, fail: 0, notValidated: 0 };

  for (const filePath of allSourceFiles) {
    const cached = cacheManager.readRaw({ documentPath: filePath });
    if (!cached) {
      validation.notValidated++;
    } else if (cached.result.compliant) {
      validation.pass++;
    } else if (cached.result.severity === "warning") {
      validation.warn++;
    } else {
      validation.fail++;
    }
  }

  return {
    counts: {
      roles: roleFiles.length,
      responsibilities: respFiles.length,
      references,
      context: contextCount,
    },
    validation,
    orphanedResponsibilities,
    danglingRefs,
    rolesMissingDescription,
    zeroMatchGlobs,
    unmatchedOwners,
  };
}

/**
 * Lists content files in a directory, excluding templates and READMEs.
 *
 * @param dir - Absolute path to the content directory
 * @param recursive - Whether to search subdirectories
 */
async function listContentFiles(
  dir: string,
  recursive = false,
  specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
  ignore: string[] = [],
): Promise<string[]> {
  if (!existsSync(dir)) return [];

  const pattern = recursive ? "**/*.md" : "*.md";
  const files = await fg(pattern, { cwd: dir, onlyFiles: true, absolute: true, ignore });

  return files.filter((f) => !isSpecFile(f, specFilePattern) && !basename(f).startsWith("_"));
}

/**
 * Lists all .md content files across all source directories.
 *
 * Recursively scans each source directory, excluding templates and READMEs.
 * Returns absolute paths suitable for cache lookups.
 */
async function listAllSourceFiles(
  root: string,
  sources: string[],
  specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
  ignore: string[] = [],
): Promise<string[]> {
  const files: string[] = [];

  for (const source of sources) {
    const sourceDir = resolve(root, source);
    if (!existsSync(sourceDir)) continue;

    const mdFiles = await fg("**/*.md", { cwd: sourceDir, onlyFiles: true, absolute: true, ignore });
    for (const f of mdFiles) {
      const name = basename(f);
      if (isSpecFile(name, specFilePattern) || name.startsWith("_")) continue;
      files.push(f);
    }
  }

  return files;
}

/**
 * Displays the status report to the console.
 */
function displayReport(report: StatusReport, logger: Logger): void {
  logger.info("Praxis Project Status");
  console.log();
  console.log(`  Roles:              ${report.counts.roles}`);
  console.log(`  Responsibilities:   ${report.counts.responsibilities}`);
  console.log(`  References:         ${report.counts.references}`);
  console.log(`  Context files:      ${report.counts.context}`);

  // Validation summary
  const v = report.validation;
  const totalDocs = v.pass + v.warn + v.fail + v.notValidated;
  if (totalDocs > 0) {
    console.log();
    logger.info("Validation");
    console.log(`  ${chalk.green("[PASS]")} ${v.pass}`);
    console.log(`  ${chalk.yellow("[WARN]")} ${v.warn}`);
    console.log(`  ${chalk.red("[FAIL]")} ${v.fail}`);
    console.log(`  ${chalk.gray("[NOT VALIDATED]")} ${v.notValidated}`);
  }

  let issueCount = 0;

  if (report.danglingRefs.length > 0) {
    console.log();
    logger.warn("Dangling references (file not found):");
    for (const { role, ref } of report.danglingRefs) {
      console.log(`  ${role} → ${ref}`);
      issueCount++;
    }
  }

  if (report.orphanedResponsibilities.length > 0) {
    console.log();
    logger.warn("Orphaned responsibilities (not referenced by any role):");
    for (const resp of report.orphanedResponsibilities) {
      console.log(`  ${resp}`);
      issueCount++;
    }
  }

  if (report.rolesMissingDescription.length > 0) {
    console.log();
    logger.warn("Roles missing description:");
    for (const role of report.rolesMissingDescription) {
      console.log(`  ${role}`);
      issueCount++;
    }
  }

  if (report.zeroMatchGlobs.length > 0) {
    console.log();
    logger.warn("Glob patterns matching zero files:");
    for (const { role, pattern } of report.zeroMatchGlobs) {
      console.log(`  ${role}: ${pattern}`);
      issueCount++;
    }
  }

  if (report.unmatchedOwners.length > 0) {
    console.log();
    logger.warn("Responsibilities with unknown owners:");
    for (const { responsibility, owner } of report.unmatchedOwners) {
      console.log(`  ${responsibility} (owner: ${owner})`);
      issueCount++;
    }
  }

  console.log();
  if (issueCount === 0) {
    logger.success("No issues found");
  } else {
    logger.info(`${issueCount} issue(s) found`);
  }
}
