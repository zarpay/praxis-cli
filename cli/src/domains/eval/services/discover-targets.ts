import type { EvalUnit, ValidationDomain } from "@/domains/eval/types.js";

import fg from "fast-glob";

import { baseName, joinPath, parentDir, relativePath } from "@/core/paths.js";
import { isSpecFile } from "@/core/spec-pattern.js";
import { SpecFile } from "@/domains/eval/models/spec-file.js";

/**
 * Finds what a run should judge, and what each spec governs.
 *
 * Everything here reads the filesystem and returns plain data — no
 * judging, no state carried between calls — so a run's scope can be
 * inspected without invoking a judge, which is what `praxis status`
 * does to compute coverage.
 *
 * Two rules apply to every scan and are the reason these live
 * together: a spec file is never itself a target, and an
 * underscore-prefixed file is a template, never a target.
 */
export class TargetDiscovery {
  private readonly root: string;
  private readonly sources: string[];
  private readonly specFilePattern: string;
  /** Ignore patterns already resolved to absolute paths for fast-glob. */
  private readonly absoluteIgnore: string[];

  constructor({
    root,
    sources,
    specFilePattern,
    absoluteIgnore = [],
  }: {
    root: string;
    sources: string[];
    specFilePattern: string;
    absoluteIgnore?: string[];
  }) {
    this.root = root;
    this.sources = sources;
    this.specFilePattern = specFilePattern;
    this.absoluteIgnore = absoluteIgnore;
  }

  /**
   * Every spec in the source directories, with what it governs.
   *
   * A spec's `paths:` expand against the project root into an explicit
   * target list; without them a spec governs its own directory's
   * siblings. Under `cohort: by_directory` the patterns match
   * directories instead of files.
   *
   * @throws PraxisError when a spec's frontmatter is malformed
   */
  domains(): ValidationDomain[] {
    const domains: ValidationDomain[] = [];

    for (const source of this.sources) {
      for (const specPath of this.specPathsIn(source)) {
        domains.push(this.domainFor(specPath));
      }
    }

    return domains;
  }

  /**
   * The evaluation units a domain should judge.
   *
   * `cohort: by_directory` yields one unit per matched directory
   * holding every member file; an empty directory yields no unit.
   * `by_file` yields one unit per target file — from `paths:` when
   * declared, otherwise the spec's sibling .md files.
   */
  units(domain: ValidationDomain): EvalUnit[] {
    const shielded = [...domain.excludes, ...domain.exemplars];

    if (domain.cohort === "by_directory") {
      return (domain.targetDirs ?? [])
        .map((dir) => ({ path: dir, files: this.members(dir, shielded) }))
        .filter((unit) => unit.files.length > 0);
    }

    if (domain.targetFiles) {
      return domain.targetFiles.map((file) => ({ path: file, files: [file] }));
    }

    return this.judgeable("*.md", domain.dir, shielded).map((file) => ({
      path: file,
      files: [file],
    }));
  }

  /**
   * Every .md document across the source directories.
   *
   * Includes documents in directories with no spec at all, which is
   * what makes them the denominator for a run's summary: a document no
   * spec covers is "not validated", not invisible.
   */
  sourceDocuments(): Set<string> {
    const docs = this.sources.flatMap((source) =>
      this.judgeable("**/*.md", joinPath(this.root, source), []),
    );

    return new Set(docs);
  }

  /** The spec files under one source directory. */
  private specPathsIn(source: string): string[] {
    return fg.sync(`**/${this.specFilePattern}`, {
      cwd: joinPath(this.root, source),
      onlyFiles: true,
      absolute: true,
      dot: true,
    });
  }

  /** One spec's domain: what it governs, and what is shielded from it. */
  private domainFor(specPath: string): ValidationDomain {
    const spec = SpecFile.at(specPath, this.root);
    const dir = parentDir(specPath);
    const excludes = spec.excludes.map((p) => joinPath(this.root, p));
    const exemplars = spec.exemplars.map((p) => joinPath(this.root, p));
    // Exemplars are shielded from adverse judgment exactly like
    // excludes; they reach the judge only as inlined positives.
    const shielded = [...this.absoluteIgnore, ...excludes, ...exemplars];

    const domain: ValidationDomain = {
      dir,
      type: relativePath(this.root, dir) || baseName(dir),
      specPath,
      excludes,
      exemplars,
      cohort: spec.cohort,
    };

    if (spec.cohort === "by_directory") {
      domain.targetDirs = this.matchDirectories(spec.paths, shielded);
    } else if (spec.paths.length > 0) {
      domain.targetFiles = this.matchFiles(spec.paths, shielded);
    }

    return domain;
  }

  /** Directories the patterns match, sorted. */
  private matchDirectories(patterns: string[], shielded: string[]): string[] {
    return fg
      .sync(patterns, {
        cwd: this.root,
        onlyDirectories: true,
        absolute: true,
        dot: true,
        ignore: shielded,
      })
      .sort();
  }

  /** Files the patterns match, minus specs and templates. */
  private matchFiles(patterns: string[], shielded: string[]): string[] {
    return fg
      .sync(patterns, {
        cwd: this.root,
        onlyFiles: true,
        absolute: true,
        dot: true,
        ignore: shielded,
      })
      .filter((file) => this.isJudgeable(file));
  }

  /** A cohort directory's member files, sorted. */
  private members(dir: string, shielded: string[]): string[] {
    return this.judgeable("**/*", dir, shielded).sort();
  }

  /** Files matching a pattern in a directory, minus specs and templates. */
  private judgeable(pattern: string, cwd: string, shielded: string[]): string[] {
    return fg
      .sync(pattern, {
        cwd,
        onlyFiles: true,
        absolute: true,
        dot: true,
        ignore: [...this.absoluteIgnore, ...shielded],
      })
      .filter((file) => this.isJudgeable(file));
  }

  /** Whether a path is a judgeable target rather than a spec or template. */
  private isJudgeable(file: string): boolean {
    const name = baseName(file);

    return !isSpecFile(name, this.specFilePattern) && !name.startsWith("_");
  }
}
