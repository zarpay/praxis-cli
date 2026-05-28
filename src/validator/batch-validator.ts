import { basename, dirname, join, relative } from "node:path";

import fg from "fast-glob";

import { Frontmatter } from "@/compiler/frontmatter.js";
import { DEFAULT_SPEC_FILE_PATTERN } from "@/core/config.js";

import { CacheManager, type CachedValidationResult } from "./cache-manager.js";
import { DocumentValidator } from "./document-validator.js";
import { isSpecFile } from "./spec-pattern.js";

/** Extended validation result that includes file path and type information. */
export interface BatchValidationResult extends CachedValidationResult {
  path: string;
  type: string;
  filename: string;
}

/** Aggregated validation summary across all documents. */
export interface ValidationSummary {
  total: number;
  compliant: number;
  warnings: number;
  errors: number;
  notValidated: number;
  byType: Record<
    string,
    {
      total: number;
      compliant: number;
      issues: number;
    }
  >;
}

/** A validation domain: a spec file and the documents it validates. */
interface ValidationDomain {
  dir: string;
  readmePath: string;
  type: string;
  targetFiles?: string[];
}

/**
 * Validates multiple Praxis documents and aggregates results.
 *
 * Discovers validation domains by scanning source directories for
 * directories containing README.md files, validates each document
 * against its directory's README spec, and collects results with
 * optional fail-fast behavior and cache statistics.
 */
export class BatchValidator {
  readonly root: string;
  readonly sources: string[];
  readonly failFast: boolean;
  readonly cacheStats: { hits: number; misses: number };

  private readonly useCache: boolean;
  private readonly cacheManager: CacheManager | null;
  private readonly apiKeyEnvVar?: string;
  private readonly model?: string;
  private readonly specFilePattern: string;
  private readonly absoluteIgnore: string[];
  private results: BatchValidationResult[] = [];
  private stoppedEarly = false;
  private sourceDocCount = 0;

  constructor({
    root,
    sources,
    ignore = [],
    failFast = false,
    useCache = true,
    cacheManager,
    apiKeyEnvVar,
    model,
    specFilePattern = DEFAULT_SPEC_FILE_PATTERN,
  }: {
    root: string;
    sources: string[];
    ignore?: string[];
    failFast?: boolean;
    useCache?: boolean;
    cacheManager?: CacheManager;
    apiKeyEnvVar?: string;
    model?: string;
    specFilePattern?: string;
  }) {
    this.root = root;
    this.sources = sources;
    this.failFast = failFast;
    this.useCache = useCache;
    this.cacheManager = cacheManager ?? (useCache ? new CacheManager(undefined, root) : null);
    this.cacheStats = { hits: 0, misses: 0 };
    this.apiKeyEnvVar = apiKeyEnvVar;
    this.model = model;
    this.specFilePattern = specFilePattern;
    this.absoluteIgnore = ignore.map((p) => join(root, p));
  }

  /** Whether validation was stopped early due to fail-fast. */
  get stopped(): boolean {
    return this.stoppedEarly;
  }

  /** The accumulated validation results. */
  getResults(): BatchValidationResult[] {
    return this.results;
  }

  /**
   * Validates all documents across all discovered validation domains.
   *
   * Scans source directories for directories containing README.md,
   * then validates all .md files in those directories.
   * Skips READMEs and template files. Respects fail-fast if enabled.
   */
  async validateAll(): Promise<BatchValidationResult[]> {
    this.results = [];
    this.stoppedEarly = false;
    this.sourceDocCount = this.countAllSourceDocuments();

    const domains = await this.discoverValidationDomains();

    for (const domain of domains) {
      if (this.stoppedEarly) break;

      for (const docPath of this.resolveDocuments(domain)) {
        if (this.stoppedEarly) break;

        await this.validateDocument(docPath, domain.readmePath, domain.type);
        this.checkFailFast();
      }
    }

    return this.results;
  }

  /**
   * Validates all documents of a specific type.
   *
   * @param type - Type string to filter by (matches directory name or relative path)
   * @throws Error if no matching type is found
   */
  async validateType(type: string): Promise<BatchValidationResult[]> {
    this.results = [];
    this.stoppedEarly = false;
    this.sourceDocCount = this.countAllSourceDocuments();

    const domains = await this.discoverValidationDomains();
    const matching = domains.filter((d) => d.type === type || basename(d.dir) === type);

    if (matching.length === 0) {
      throw new Error(`Unknown document type: ${type}`);
    }

    for (const domain of matching) {
      if (this.stoppedEarly) break;

      for (const docPath of this.resolveDocuments(domain)) {
        if (this.stoppedEarly) break;

        await this.validateDocument(docPath, domain.readmePath, domain.type);
        this.checkFailFast();
      }
    }

    return this.results;
  }

  /** Computes an aggregated summary of all validation results. */
  summary(): ValidationSummary {
    const byType: ValidationSummary["byType"] = {};

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

    const validated = this.results.length;

    return {
      total: this.sourceDocCount > 0 ? this.sourceDocCount : validated,
      compliant: this.results.filter((r) => r.compliant).length,
      warnings: this.results.filter((r) => !r.compliant && r.severity === "warning").length,
      errors: this.results.filter((r) => !r.compliant && r.severity === "error").length,
      notValidated: this.sourceDocCount > 0 ? this.sourceDocCount - validated : 0,
      byType,
    };
  }

  /**
   * Counts all .md documents across source directories.
   *
   * Includes documents in directories without a README.md spec,
   * providing the true total of source documents. Excludes READMEs
   * and template files (those starting with `_`).
   */
  private countAllSourceDocuments(): number {
    let count = 0;

    for (const source of this.sources) {
      const sourceAbsPath = join(this.root, source);
      const allMdFiles = fg.sync("**/*.md", {
        cwd: sourceAbsPath,
        onlyFiles: true,
        dot: true,
        ignore: this.absoluteIgnore,
      });

      for (const file of allMdFiles) {
        const name = basename(file);
        if (isSpecFile(name, this.specFilePattern) || name.startsWith("_")) continue;
        count++;
      }
    }

    return count;
  }

  /**
   * Returns the list of documents a domain should validate.
   *
   * Uses `targetFiles` when the spec declared `paths` frontmatter,
   * otherwise scans the spec's own directory for sibling .md files.
   */
  private resolveDocuments(domain: ValidationDomain): string[] {
    if (domain.targetFiles) {
      return domain.targetFiles;
    }
    return fg.sync("*.md", { cwd: domain.dir, onlyFiles: true, absolute: true, dot: true, ignore: this.absoluteIgnore }).filter((f) => {
      const name = basename(f);
      return !isSpecFile(name, this.specFilePattern) && !name.startsWith("_");
    });
  }

  /**
   * Discovers validation domains by scanning source directories.
   *
   * For each spec file found, checks for an optional `paths` frontmatter
   * field. When present, the glob patterns are expanded against the project
   * root to build an explicit target file list. Otherwise the spec validates
   * sibling files in its own directory.
   */
  private async discoverValidationDomains(): Promise<ValidationDomain[]> {
    const domains: ValidationDomain[] = [];

    for (const source of this.sources) {
      const sourceAbsPath = join(this.root, source);
      const specPaths = fg.sync(`**/${this.specFilePattern}`, {
        cwd: sourceAbsPath,
        onlyFiles: true,
        absolute: true,
        dot: true,
        ignore: this.absoluteIgnore,
      });

      for (const specPath of specPaths) {
        const dir = dirname(specPath);
        const type = relative(this.root, dir) || basename(dir);

        const fm = new Frontmatter(specPath);
        const pathPatterns = fm.array("paths") as string[];

        if (pathPatterns.length > 0) {
          const targetFiles = fg
            .sync(pathPatterns, {
              cwd: this.root,
              onlyFiles: true,
              absolute: true,
              dot: true,
              ignore: this.absoluteIgnore,
            })
            .filter((f) => {
              const name = basename(f);
              return !isSpecFile(name, this.specFilePattern) && !name.startsWith("_");
            });

          domains.push({ dir, readmePath: specPath, type, targetFiles });
        } else {
          domains.push({ dir, readmePath: specPath, type });
        }
      }
    }

    return domains;
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
   * Validates a single document and appends the result.
   *
   * Tracks cache hit/miss statistics for reporting.
   */
  private async validateDocument(docPath: string, specPath: string, type: string): Promise<void> {
    console.log(`Validating ${docPath}`);

    try {
      const validator = new DocumentValidator({
        documentPath: docPath,
        specPath,
        specFilePattern: this.specFilePattern,
        useCache: this.useCache,
        cacheManager: this.cacheManager ?? undefined,
        apiKeyEnvVar: this.apiKeyEnvVar,
        model: this.model,
      });

      const result = await validator.validate();

      if (validator.cacheHit) {
        this.cacheStats.hits++;
      } else {
        this.cacheStats.misses++;
      }

      this.results.push({
        ...result,
        path: docPath,
        type,
        filename: basename(docPath),
      });
    } catch (err) {
      this.results.push({
        path: docPath,
        type,
        filename: basename(docPath),
        compliant: false,
        severity: "error",
        issues: [`Validation failed: ${(err as Error).message}`],
        reason: (err as Error).message,
      });
    }
  }
}
