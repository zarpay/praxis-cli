// The eval loop: subjects, verdicts, critiques, units, runs — and the
// diff unit (12) with its flow shapes.

import type { LedgerFlow } from "@/types/ledger.js";
import type { Severity } from "@/types/shared.js";

/** How a spec groups its targets into review units. */
export type CohortMode = "by_file" | "by_directory";

/**
 * A file inlined into the review input beyond the target itself:
 * its display path and content. Exemplars and context files are both
 * this shape (03).
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
 * One active axiom as the reviewer's checklist carries it (04): the
 * ratified standard with its full teaching material, so the reviewer
 * judges against the extension, not just a label.
 */
export interface ChecklistAxiom {
  id: string;
  version: number;
  severity: Severity;
  /** What the axiom asserts, one line for findings surfaces. */
  statement: string;
  /** Statement plus both examples, as authored. */
  body: string;
}

/**
 * One reported deviation: the atomic unit of evidence (vocabulary).
 *
 * Born on one of the reviewer's two channels (04): matched critiques
 * carry the checklist axiom they are an instance of; open-channel
 * critiques carry null and flow onward to triage as open codes.
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
   * them (03: prevention beats calibration).
   */
  excludes: string[];
  /**
   * Spec-blessed positive examples from `exemplars:`, resolved to
   * absolute glob patterns. Shielded from adverse review the same way
   * excludes are; the Reviewer inlines them into the prompt as positives.
   */
  exemplars: string[];
  /** Explicit target files when the spec declares `paths:` (by_file). */
  targetFiles?: string[];
  /** Matched directories when the spec declares `cohort: by_directory`. */
  targetDirs?: string[];
}

/** Extended validation result that includes file path and type information. */
export interface TargetVerdict extends Verdict {
  /** Absolute path of the validated document. */
  path: string;
  /** Set when the unit could not be reviewed at all (03): never a violation. */
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
   * rates; their series render separately, never silently pooled (07).
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
  /** Reviewer names that flagged it; more than one = corroboration (06). */
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
  /** Resolved exemplar files the reviewer saw, with content hashes (present when the spec blesses any). */
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

/** One changed, spec-covered file of a diff run. */
export interface DiffTarget {
  /** Absolute path in the working tree (the cache and spec key). */
  path: string;
  /** Project-relative, as git names it. */
  relPath: string;
  /** Absolute path of the governing spec. */
  specPath: string;
  status: "added" | "deleted" | "modified";
}

/** The resolved diff: what to review, and what the specs cannot see. */
export interface ResolveDiffResult {
  baseRef: string;
  baseSha: string;
  headSha: string;
  targets: DiffTarget[];
  /** Changed files no spec governs, project-relative — the invisible work (01). */
  uncovered: string[];
}

/** One side of a verdict comparison, with the provenance that gates it. */
export interface FlowSide {
  issues: Critique[];
  specContentHash: string;
  reviewerHash: string;
}

/** One covered file's outcome under one reviewer. */
export interface DiffTargetOutcome {
  relPath: string;
  reviewerName: string;
  status: DiffTarget["status"];
  /** After-side critiques with their flow labels; empty for deleted files. */
  findings: { critique: Critique; flow: LedgerFlow | null; severity: Severity }[];
  resolved: Critique[];
  /** Either side could not be reviewed — flow withheld for this target. */
  unverified: boolean;
  /** Why the target went unverified; null otherwise. */
  unverifiedReason: string | null;
}

/** What a diff review produced across all reviewers. */
export interface ReviewDiffResult {
  perTarget: DiffTargetOutcome[];
  summary: {
    introduced: number;
    resolved: number;
    inherited: number;
    /** Introduced findings of error severity — what fails the gate. */
    errorsIntroduced: number;
    unverified: number;
  };
  cacheStats: { hits: number; misses: number };
}

/**
 * One before-only violation a diff run erased (12): the evidence for a
 * `flow: "resolved"` record, carried as plain data — the write service
 * is the only assembler of ledger records.
 */
export interface ResolvedEvent {
  /** Project-relative path of the file the violation lived in. */
  filePath: string;
  /** Absolute path of the governing spec. */
  specPath: string;
  /** Hash of the before-side content the critique described. */
  targetContentHash: string;
  specContentHash: string;
  /** The vanished critique, axiom identity included. */
  critique: Critique;
  severity: Severity;
  /** The most recent git author touching the file in base..head; null when unanswerable. */
  resolvedBy: string | null;
}
