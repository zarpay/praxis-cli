import type { GitFacts } from "@/types.js";
import type { View } from "@framework/types.js";

/**
 * The run-start anchoring notice (12): inside a repo whose tree is not
 * clean-on-a-branch, this run's evidence is attested — content hashes
 * prove what the reviewers saw — but not reconstructable from a commit.
 * That is the fast loop working as designed (feedback, not
 * measurement); the notice exists so nobody discovers it at forensics
 * time. Outside a repo there is nothing to anchor to and nothing worth
 * saying; praxis never creates commits — anchoring is the workflow's job.
 */
const runAnchoringView: View<GitFacts> = ({ inRepo, commitSha }) => {
  if (!inRepo || commitSha !== null) return [];

  return [
    {
      channel: "warning",
      text: "Working tree is not clean — this run is feedback, not measurement (12): its critiques are attested by content hashes but carry no commit to reconstruct from. Commit first when you want forensic-grade evidence.",
    },
  ];
};

export default runAnchoringView;
