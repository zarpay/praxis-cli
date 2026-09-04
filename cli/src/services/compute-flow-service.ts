import type { Critique, FlowSide, LedgerFlow, Service } from "@/types.js";

/** A before/after verdict pair for one file, ready to set-difference. */
interface ComputeFlowInput {
  /** Null when the file did not exist on that side (added / deleted). */
  before: FlowSide | null;
  after: FlowSide | null;
}

/** The flow labels a comparison produced — or its refusal. */
interface ComputeFlowResult {
  /** Label per after-side issue, parallel to `after.issues`; null = open channel. */
  afterFlow: (LedgerFlow | null)[];
  /** Matched before-side critiques absent after — the resolved events. */
  resolved: Critique[];
  /** True when the sides' provenance differed and the comparison was refused (01). */
  refused: boolean;
}

/**
 * Verdict diffing for one file (01, 12): mechanical set-difference on
 * axiom identity, never a judgment call. After-only axioms are
 * *introduced*, before-only are *resolved*, both sides *inherited* —
 * attribution is computed from two holistic verdicts, because the
 * reviewer is good at reading and bad at bookkeeping.
 *
 * Only matched critiques participate: an open-channel critique has no
 * `(axiom_id, file)` identity, and set-differencing prose would label
 * nondeterministic rephrasings as flow. Open after-critiques keep a
 * null label (they go to triage as ever); vanished open
 * before-critiques emit nothing.
 *
 * A missing side is a fact, not a failure: `before: null` (the file
 * was added) makes every matched after-critique introduced;
 * `after: null` (deleted) makes every matched before-critique
 * resolved. Two same-axiom critiques on one side share one identity
 * and one label — the accepted coarseness of (axiom, file) findings.
 *
 * When the two sides' provenance differs (spec content or reviewer
 * hash), the comparison is refused rather than computed: sampling
 * variance across reviewer states would masquerade as flow (01). Both
 * sides of a single `--diff` invocation share provenance by
 * construction, so the refusal guards future cross-run callers.
 */
const computeFlowService: Service<ComputeFlowInput, ComputeFlowResult> = (
  _cfg,
  { before, after },
) => {
  if (before !== null && after !== null && !sharedProvenance(before, after)) {
    return {
      afterFlow: after.issues.map(() => null),
      resolved: [],
      refused: true,
    };
  }

  const beforeAxioms = matchedAxiomIds(before?.issues ?? []);
  const afterAxioms = matchedAxiomIds(after?.issues ?? []);

  const afterFlow = (after?.issues ?? []).map((issue) => labelFor(issue, beforeAxioms));

  const resolved = (before?.issues ?? []).filter(
    (issue) => issue.axiomId !== null && !afterAxioms.has(issue.axiomId),
  );

  return { afterFlow, resolved, refused: false };
};

export default computeFlowService;

/** Whether two sides describe the same measurement state (01). */
function sharedProvenance(
  before: { specContentHash: string; reviewerHash: string },
  after: { specContentHash: string; reviewerHash: string },
): boolean {
  return (
    before.specContentHash === after.specContentHash && before.reviewerHash === after.reviewerHash
  );
}

/** The axiom ids a side's matched critiques carry. */
function matchedAxiomIds(issues: Critique[]): Set<string> {
  const ids = issues.map((issue) => issue.axiomId).filter((id): id is string => id !== null);

  return new Set(ids);
}

/** One after-critique's label: null on the open channel. */
function labelFor(issue: Critique, beforeAxioms: Set<string>): LedgerFlow | null {
  if (issue.axiomId === null) return null;

  return beforeAxioms.has(issue.axiomId) ? "inherited" : "introduced";
}
