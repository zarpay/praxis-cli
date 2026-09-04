// Cross-domain vocabulary: the words every domain speaks.

/** Severity level for validation issues. */
export type Severity = "warning" | "error";

/** The reference keys an expert can point at other documents with. */
export type RefKey = "practices" | "context" | "refs";

/** One unreadable file in a store sweep: reported, never fatal. */
export interface StoreProblem {
  path: string;
  message: string;
}

/**
 * What git can attest about a run's anchoring (05, 12). `commitSha`
 * non-null means the reviewed disk state provably equals a named,
 * reviewable commit — reconstruction-grade evidence. Null inside a repo
 * means the run was feedback on a transient state: attested by content
 * hashes, not reproducible from git.
 */
export interface GitFacts {
  inRepo: boolean;
  commitSha: string | null;
  branch: string | null;
}
