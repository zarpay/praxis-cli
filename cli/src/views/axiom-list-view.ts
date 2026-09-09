import type { AxiomFile } from "@/models/axiom-file.js";
import type { ListAxiomsResult } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

import chalk from "chalk";

import { table } from "@framework/views/table.js";

/**
 * The axiom store at a glance: an aligned identity table with each
 * axiom's statement beneath its row, chronological, problems reported
 * at the end. A leftover `proposed` axiom (from
 * before acceptance activated directly) is flagged with the way out.
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

  const identityRows = axioms.map((axiom) => [
    axiom.id,
    `v${axiom.version}`,
    axiom.status,
    axiom.severity,
    axiom.introduced,
  ]);
  const identityLines = table(identityRows, ["ID", "VER", "STATUS", "SEVERITY", "INTRODUCED"]);
  const header = identityLines.slice(0, 2);
  const rows = identityLines.slice(2);
  const entries = axioms.flatMap((axiom, index) => [
    rows[index] ?? "",
    `    ${chalk.dim(axiom.statement().replace(/\s+/g, " "))}`,
    "",
  ]);

  const lines: ReportLine[] = [
    { channel: "heading", text: `Axioms (${axioms.length})` },
    { channel: "content", entries: [...header, ...entries] },
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
