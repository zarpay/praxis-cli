import type { ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

/** One critique framed for the validity call. */
interface ReviewCritiqueCard {
  /** 1-based position in the session. */
  index: number;
  total: number;
  id: string;
  filePath: string;
  specPath: string;
  reviewerName: string;
  severity: string;
  text: string;
  /** Where it stands in the label lifecycle, for context. */
  state: string;
  axiomId: string | null;
}

/**
 * One critique of a review session, framed as a card the human judges:
 * where it was said and by whom, the reviewer's words, and where the
 * label lifecycle has it — one critique at a time.
 */
const reviewCritiqueView: View<ReviewCritiqueCard> = ({
  index,
  total,
  id,
  filePath,
  specPath,
  reviewerName,
  severity,
  text,
  state,
  axiomId,
}) => {
  const standing = axiomId === null ? state : `${state} → ${axiomId}`;

  const lines: ReportLine[] = [
    { channel: "heading", text: `Critique ${index}/${total} — ${filePath}` },
    {
      channel: "content",
      entries: [
        `  ${chalk.gray(`[${reviewerName}] ${severity} · spec ${specPath}`)} ${chalk.gray(id)}`,
        `    ${text}`,
        "",
        `  ${chalk.cyan("Standing:")} ${standing}`,
      ],
    },
  ];

  return lines;
};

export default reviewCritiqueView;
