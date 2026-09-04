import type { ResolveDiffResult } from "@/types.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/**
 * What a diff run announces before reviewing (12): the range being
 * measured and the coverage split — uncovered changed files are named,
 * because work the specs cannot see must never be invisibly invisible
 * (01: the report says how much work was invisible).
 */
const diffHeadlineView: View<ResolveDiffResult> = ({
  baseRef,
  baseSha,
  headSha,
  targets,
  uncovered,
}) => {
  const range = `${baseRef} (${baseSha.slice(0, 7)}) → HEAD (${headSha.slice(0, 7)})`;
  const changed = targets.length + uncovered.length;

  return [
    { channel: "heading", text: `Reviewing the diff against ${range}` },
    {
      channel: "content",
      entries: [
        `${changed} changed file(s) · ${targets.length} covered by specs`,
        ...(uncovered.length > 0
          ? [chalk.gray(`Uncovered (invisible to the eval): ${uncovered.join(", ")}`)]
          : []),
      ],
    },
  ];
};

export default diffHeadlineView;
