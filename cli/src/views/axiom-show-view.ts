import type { AxiomFile } from "@/models/axiom-file.js";
import type { View } from "@framework/types.js";

import chalk from "chalk";

/** One of the category's labeled critiques, shown as a live example. */
interface RepresentativeCritique {
  id: string;
  filePath: string;
  reviewerName: string;
  text: string;
}

/** One axiom, shown in full. */
interface ShownAxiom {
  axiom: AxiomFile;
  /** Up to five of the category's labeled critiques. */
  critiques: RepresentativeCritique[];
  /** How many critiques carry this label in total. */
  labeledCount: number;
}

/**
 * One category in full: the statement naming the recurring issue, the
 * spec passage the norm lives in, and the category's real examples —
 * its labeled critiques, live from the ledger. Historical axiom files
 * may still carry example sections in their body; they render as
 * written.
 */
const axiomShowView: View<ShownAxiom & { json?: boolean }> = ({
  axiom,
  critiques,
  labeledCount,
  json,
}) => {
  if (json) {
    const payload = {
      id: axiom.id,
      version: axiom.version,
      status: axiom.status,
      mode: axiom.mode,
      severity: axiom.severity,
      derived_from: axiom.derivedFrom,
      introduced: axiom.introduced,
      statement: axiom.statement(),
      body: axiom.body,
      labeled_count: labeledCount,
      representative_critiques: critiques,
    };

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const facts = [
    `introduced: ${axiom.introduced} · mode: ${axiom.mode}`,
    ...(axiom.severity === null ? [] : [`severity: ${axiom.severity} (historical)`]),
    `derives from: ${axiom.derivedFrom ?? "—"}`,
  ];

  const examples = critiques.flatMap((critique) => [
    `  ${critique.filePath} ${chalk.gray(`[${critique.reviewerName}]`)} ${chalk.gray(critique.id)}`,
    `    ${chalk.dim(critique.text)}`,
    "",
  ]);

  return [
    { channel: "heading", text: `${axiom.id} v${axiom.version} — ${axiom.status}` },
    {
      channel: "content",
      entries: [
        ...facts,
        "",
        axiom.body.trim(),
        ...(critiques.length > 0
          ? [
              "",
              `Labeled critiques (${labeledCount} total${labeledCount > critiques.length ? `, showing ${critiques.length}` : ""}):`,
              "",
              ...examples,
              "Browse all: `praxis eval critiques --axiom " + axiom.id + "`",
            ]
          : []),
      ],
    },
  ];
};

export default axiomShowView;
