import type { View } from "@framework/types.js";

import chalk from "chalk";

/** Where one critique stands in the review→label lifecycle. */
type CritiqueState = "untriaged" | "unmatched" | "labeled" | "dismissed";

/** One critique as the listing shows it. */
interface CritiqueRow {
  id: string;
  filePath: string;
  reviewerName: string;
  text: string;
  state: CritiqueState;
  axiomId: string | null;
}

/** The listing and the whole-ledger tallies. */
interface CritiquesListing {
  rows: CritiqueRow[];
  totals: Record<CritiqueState, number>;
  json?: boolean;
}

/**
 * The critique listing: one card per critique — id and file, the
 * reviewer's words, then where it stands — with the ledger-wide tallies
 * as the heading. The ids are what `praxis axioms reassign` takes.
 */
const critiquesView: View<CritiquesListing> = ({ rows, totals, json }) => {
  if (json) {
    return [
      { channel: "content", entries: [JSON.stringify({ totals, critiques: rows }, null, 2)] },
    ];
  }

  const tally = `untriaged ${totals.untriaged} · unmatched ${totals.unmatched} · labeled ${totals.labeled} · dismissed ${totals.dismissed}`;

  if (rows.length === 0) {
    return [
      { channel: "heading", text: `Critiques — none in scope (${tally})` },
      { channel: "content", entries: ["Nothing matches the filters."] },
    ];
  }

  const cards = rows.flatMap((row) => [
    `${row.filePath} ${chalk.gray(`[${row.reviewerName}]`)} ${chalk.gray(row.id)}`,
    `  ${chalk.dim(row.text)}`,
    `  ${stateLine(row)}`,
    "",
  ]);

  return [
    { channel: "heading", text: `Critiques — ${rows.length} in scope (${tally})` },
    { channel: "content", entries: cards },
  ];
};

export default critiquesView;

/** The state, colored by what it asks of the human. */
function stateLine(row: CritiqueRow): string {
  if (row.state === "labeled") return `→ ${chalk.cyan(row.axiomId ?? "")}`;

  if (row.state === "unmatched") return `→ ${chalk.yellow("unmatched")} — awaiting curation`;

  if (row.state === "dismissed") return `→ ${chalk.gray("dismissed")}`;

  return `→ ${chalk.magenta("untriaged")}`;
}
