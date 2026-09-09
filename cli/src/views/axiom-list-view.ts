import type { AxiomFile } from "@/models/axiom-file.js";
import type { ListAxiomsResult } from "@/types.js";
import type { ReportLine, View } from "@framework/types.js";

/**
 * The axiom store at a glance: one line per axiom, chronological,
 * problems reported at the end. A leftover `proposed` axiom (from
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

  const lines: ReportLine[] = [
    { channel: "heading", text: `Axioms (${axioms.length})` },
    { channel: "content", entries: axioms.map(listLine) },
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

/** One axiom's line: identity, state, cost, and what it asserts. */
function listLine(axiom: AxiomFile): string {
  const facts = [
    axiom.id,
    `v${axiom.version}`,
    axiom.status.padEnd(10),
    axiom.severity.padEnd(7),
    axiom.introduced,
  ].join("  ");

  return `${facts}  ${firstLine(axiom.statement())}`;
}

/** A statement's first line, so the list stays one line per axiom. */
function firstLine(statement: string): string {
  return statement.split("\n", 1)[0];
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
