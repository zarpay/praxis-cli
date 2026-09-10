import type { View } from "@framework/types.js";

import { card } from "@framework/views/card.js";
import { palette } from "@framework/views/palette.js";

/** Where one critique stands in the review→label lifecycle. */
type CritiqueState = "untriaged" | "unmatched" | "labeled" | "dismissed";

/** One critique as the listing shows it. */
interface CritiqueRow {
  id: string;
  runId: string;
  timestamp: string;
  filePath: string;
  reviewerName: string;
  severity: string;
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
 * The critique listing: one block per critique, separated by a rule —
 * the id, when and in which run it was said, the file, the reviewer, and
 * the reviewer's words — everything in the terminal's default text color,
 * nothing dimmed — then where
 * the label lifecycle has it — with the ledger-wide tallies as the
 * heading. The ids are what `praxis axioms reassign` and
 * `praxis eval review` take.
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

  const blocks = rows.flatMap((row) => [...critiqueBlock(row), ""]);

  return [
    { channel: "heading", text: `Critiques — ${rows.length} in scope (${tally})` },
    { channel: "content", entries: blocks },
  ];
};

export default critiquesView;

/** One critique's card: identity in the title, provenance as attributes, the words as body. */
function critiqueBlock(row: CritiqueRow): string[] {
  return card({
    title: `critique ${row.id}`,
    attrs: [
      ["when", row.timestamp.replace("T", " ").slice(0, 19)],
      ["run", row.runId],
      ["file", row.filePath],
      ["reviewer", `${row.reviewerName} · ${row.severity}`],
    ],
    body: [row.text],
    footer: `${palette.meta("standing")}  ${stateLine(row)}`,
  });
}

/** The state, colored by what it asks of the human. */
function stateLine(row: CritiqueRow): string {
  if (row.state === "labeled") return palette.ref(row.axiomId ?? "");

  if (row.state === "unmatched") return `${palette.warn("unmatched")} — awaiting curation`;

  if (row.state === "dismissed") return "dismissed";

  return `${palette.attention("untriaged")} — awaiting triage`;
}
