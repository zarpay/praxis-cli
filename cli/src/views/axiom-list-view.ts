import type { AxiomFile } from "@/models/axiom-file.js";
import type { ListAxiomsResult } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import { palette } from "@framework/views/palette.js";
import { table } from "@framework/views/table.js";

/**
 * The axiom store at a glance: one outlined table, chronological, with
 * each category's statement elided into its row — the full statement is
 * `axioms show`'s job. Problems report at the end, and a leftover
 * `proposed` axiom (from before acceptance activated directly) is
 * flagged with the way out.
 *
 * With `json` set, the same state renders as the stable machine
 * contract instead — never both, never disagreeing.
 */
const axiomListView: View<ListAxiomsResult & { json?: boolean }> = ({ axioms, problems, json }) => {
  if (json) {
    return [{ channel: "content", entries: [JSON.stringify(axioms.map(axiomJson), null, 2)] }];
  }

  if (axioms.length === 0 && problems.length === 0) {
    return [
      {
        channel: "content",
        entries: ["No axioms yet. They are born from critiques: run `praxis axioms triage`."],
      },
    ];
  }

  const rows = axioms.map((axiom) => [
    palette.ref(axiom.id),
    `v${axiom.version}`,
    statusCell(axiom.status),
    palette.meta(axiom.introduced),
    palette.quote(elide(axiom.statement())),
  ]);
  const listing = table(rows, ["ID", "VER", "STATUS", "INTRODUCED", "STATEMENT"]);

  const lines: ReportLine[] = [
    { channel: "heading", text: `Axioms (${axioms.length})` },
    { channel: "content", entries: listing },
  ];

  const proposed = axioms.filter((axiom) => axiom.status === "proposed").length;

  if (proposed > 0) {
    lines.push({
      channel: "warning",
      text: `${proposed} axiom(s) still carry the retired \`proposed\` status — curate acceptance activates directly now. Edit each file to \`status: active\` with a \`derived_from\`, or delete it and re-curate.`,
    });
  }

  for (const problem of problems) {
    lines.push({
      channel: "warning",
      text: `Unreadable axiom ${problem.path}: ${problem.message}`,
    });
  }

  return lines;
};

/** The status, colored by the one meaning each color carries. */
function statusCell(status: string): string {
  if (status === "active") return palette.good(status);

  if (status === "proposed") return palette.warn(status);

  return palette.meta(status);
}

/** One-line statement, elided to keep the table within a terminal. */
function elide(statement: string): string {
  const flat = statement.replace(/\s+/g, " ");

  return flat.length <= 46 ? flat : `${flat.slice(0, 45)}…`;
}

/** The stable JSON shape for one axiom (schema changes are breaking). */
function axiomJson(axiom: AxiomFile): Record<string, unknown> {
  return {
    id: axiom.id,
    version: axiom.version,
    status: axiom.status,
    mode: axiom.mode,
    severity: axiom.severity,
    derived_from: axiom.derivedFrom,
    introduced: axiom.introduced,
    statement: axiom.statement(),
  };
}

export default axiomListView;
