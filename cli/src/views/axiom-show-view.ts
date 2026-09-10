import type { AxiomFile } from "@/models/axiom-file.js";
import type { View } from "@framework/types.js";

import { card } from "@framework/views/card.js";
import { palette } from "@framework/views/palette.js";

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

  const statusMark =
    axiom.status === "active" ? palette.good("● active") : palette.meta(`● ${axiom.status}`);

  const identity = card({
    title: `${axiom.id} v${axiom.version}`,
    attrs: [
      ["status", statusMark],
      ["derives from", axiom.derivedFrom ?? "—"],
      ["introduced", `${axiom.introduced} · mode ${axiom.mode}`],
      ...(axiom.severity === null
        ? []
        : ([["severity", `${axiom.severity} ${palette.meta("(historical)")}`]] as [
            string,
            string,
          ][])),
    ],
    body: axiom.body.trim().split("\n"),
  });

  const examples = critiques.flatMap((critique) => [
    `${critique.filePath} ${palette.meta(`[${critique.reviewerName}]`)} ${palette.meta(critique.id)}`,
    palette.quote(`  ${critique.text}`),
    "",
  ]);

  return [
    {
      channel: "content",
      entries: [
        "",
        ...identity,
        ...(critiques.length > 0
          ? [
              "",
              palette.structure(
                `Labeled critiques ${palette.meta(`(${labeledCount} total${labeledCount > critiques.length ? `, showing ${critiques.length}` : ""})`)}`,
              ),
              "",
              ...examples,
              `${palette.meta("browse all")}  ${palette.ref(`praxis eval critiques --axiom ${axiom.id}`)}`,
            ]
          : []),
      ],
    },
  ];
};

export default axiomShowView;
