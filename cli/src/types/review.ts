// The eval loop: subjects, verdicts, critiques, units, runs.

import type { Severity } from "@/types/shared.js";

/** How a spec groups its targets into review units. */
export type CohortMode = "by_file" | "by_directory";

/**
 * A file inlined into the review input beyond the target itself:
 * its display path and content. Exemplars and context files are both
 * this shape.
 */
export interface AssistFile {
  path: string;
  content: string;
}

/** Provenance record for one assist file as stored in a cache entry. */
export interface AssistFileRecord {
  path: string;
  hash: string;
}

/**
 * One active axiom as the labeling pass carries it: a named category
 * of recurring critique — id, version, and the statement naming the
 * issue. The norm lives in the spec it derives from.
 */
export interface ActiveAxiom {
  id: string;
  version: number;
  /** Names the recurring issue the category collects. */
  statement: string;
}

/**
 * One reported deviation: the atomic unit of evidence (vocabulary).
 *
 * Born raw — the reviewer sees only the spec — and labeled afterwards
 * into an axiom category at triage; the ids stay null at review time.
 */
export interface Critique {
  text: string;
  /** The checklist axiom it was born under; null = open channel. */
  axiomId: string | null;
  /** The matched axiom's version at review time; null on open channel. */
  axiomVersion: number | null;
}

/** Result of a single review, as stored in cache. */
export interface Verdict {
  /** Whether the target satisfies its spec. */
  compliant: boolean;
  /** Specific deviations reported by the reviewer (empty when compliant). */
  issues: Critique[];
  /** The reviewer's overall explanation of the verdict. */
  reason: string;
  /** Present only when non-compliant: warning or error. */
  severity?: Severity;
}

/**
 * One review unit: what receives a single verdict.
 *
 * Under `by_file` (the default) a unit is one file and `path` is that
 * file. Under `by_directory` a unit is a directory matched by the
 * spec's `paths:` patterns, `path` is the directory, and `files` are
 * every file it contains — reviewed together as one input.
 */
export interface EvalUnit {
  path: string;
  files: string[];
}

/** A validation domain: a spec file and the targets it validates. */
export interface ValidationDomain {
  /** Directory containing the spec file. */
  dir: string;
  /** Absolute path to the spec file. */
  specPath: string;
  /** Type label derived from the spec's directory (root-relative path). */
  type: string;
  /** How targets group into review units. */
  cohort: CohortMode;
  /**
   * Structural exclusions from the spec's `excludes:` frontmatter,
   * resolved to absolute glob patterns. Excluded files never become
   * units and never enter cohort membership — the reviewer never sees
   * them.
   */
  excludes: string[];
  /** Explicit target files when the spec declares `paths:` (by_file). */
  targetFiles?: string[];
  /** Matched directories when the spec declares `cohort: by_directory`. */
  targetDirs?: string[];
}

/** Extended validation result that includes file path and type information. */
export interface TargetVerdict extends Verdict {
  /** Absolute path of the validated document. */
  path: string;
  /** Set when the unit could not be reviewed at all: never a violation. */
  unverified?: true;
  /** Type label of the domain that validated it (spec directory, root-relative). */
  type: string;
  /** Basename of the validated document. */
  filename: string;
  /** Name of the reviewer that produced this verdict. */
  reviewer: string;
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
  /** Units that could not be reviewed at all — never counted as violations. */
  unverified: number;
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
   * Per-reviewer breakdown. Reviewers are instruments with different error
   * rates; their series render separately, never silently pooled.
   */
  byReviewer: Record<
    string,
    {
      compliant: number;
      warnings: number;
      errors: number;
    }
  >;
}

/** What is happening, as a run happens. */
export type EvalProgress =
  | {
      kind: "unit-start";
      /** 1-based position across the whole run, reviewers included. */
      index: number;
      total: number;
      path: string;
      /** Member count when the unit is a cohort, undefined for a file. */
      cohortSize?: number;
      /** The reviewer's name, only when more than one reviewer is running. */
      reviewerName?: string;
    }
  | { kind: "verdict"; verdict: Verdict }
  | { kind: "unit-error"; message: string };

/** Everything a completed run produced. */
export interface ReviewAllResult {
  /** One verdict per (unit, reviewer), in the order they were reviewed. */
  verdicts: TargetVerdict[];
  /** Aggregated counts across the whole run. */
  summary: EvalSummary;
  /** Cache hits and misses accumulated over the run. */
  cacheStats: { hits: number; misses: number };
  /** Whether fail-fast stopped the run before every unit was reviewed. */
  stoppedEarly: boolean;
}

/**
 * One deduplicated finding (vocabulary): what a developer or agent
 * works through. Matched critiques collapse to their axiom — one
 * finding, corroboration counted; open-channel critiques have no shared
 * identity yet, so each is its own finding until triage.
 */
export interface Finding {
  /** The axiom violated; null = open channel (raw critique). */
  axiomId: string | null;
  /** The axiom's statement (matched) or the critique text (open). */
  text: string;
  severity: Severity;
  /** Reviewer names that flagged it; more than one = corroboration. */
  witnesses: string[];
}

/** One named target's outcome: the worst verdict, and the finding list. */
export interface ReviewedTarget {
  path: string;
  /** The worst verdict across reviewers — the badge and the reason. */
  verdict: Verdict;
  /** Deduplicated across reviewers by (axiom, text) — what to work through. */
  findings: Finding[];
  /** How many reviewers ran, so witness counts read as fractions. */
  reviewerCount: number;
  /** Show the full reasoning. */
  verbose?: boolean;
}

/** Structured report data for a single target. */
export interface VerdictReport {
  /** Path of the reported target. */
  targetPath: string;
  /** Overall status, with staleness taking priority over the cached verdict. */
  status: VerdictReportStatus;
  /** The cached validation entry, or null if never validated. */
  cacheData: CacheFileData | null;
  /** Content hash of the target as it exists now, or null if uncomputable. */
  currentHash: string | null;
  /** Whether the target changed since the cached validation. */
  isStale: boolean;
}

/** All possible report states. */
export type VerdictReportStatus = "not_validated" | "pass" | "warn" | "fail" | "stale";

/** Identity of the reviewer whose verdicts a VerdictStore addresses. */
export interface CacheReviewerIdentity {
  name: string;
  model: string;
  hash: string;
}

/**
 * One stored verdict inside a target's cache file, carrying enough
 * reviewer provenance to be read by a human in the committed JSON.
 */
export interface VerdictEntry {
  reviewer: CacheReviewerIdentity;
  spec_path: string;
  cached_at: string;
  content_hash: string;
  /** Historical (retired `exemplars:` key): present on old cache entries only; never written. */
  exemplar_files?: AssistFileRecord[];
  /** Resolved context files the reviewer saw, with content hashes (present when the spec declares any). */
  context_files?: AssistFileRecord[];
  result: Verdict;
}

/**
 * Cache data shape returned by readRaw() and readAllRaw().
 *
 * A flattened per-verdict view for report consumers.
 */
export interface CacheFileData {
  version: string;
  cached_at: string;
  content_hash: string;
  document: {
    path: string;
    spec_path: string;
  };
  result: Verdict;
}

/** What a prune removed. */
export interface PruneCacheResult {
  /** Entries dropped because no configured reviewer owns their hash. */
  entriesPruned: number;
  /** Files deleted: emptied by pruning, or unreadable/outdated outright. */
  filesRemoved: number;
}
