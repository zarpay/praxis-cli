import type { HarnessBrief, HarnessBriefAxiom } from "@/types.js";
import type { DisplayEntry, View } from "@framework/types.js";

/**
 * The harness brief, rendered as the markdown a human ratifies from
 * (08-h) — or, with `json`, the same brief as the stable machine
 * contract the generated /praxis-harness command reads.
 */
const harnessBriefView: View<HarnessBrief & { json?: boolean }> = (brief) => {
  if (brief.json) {
    const { json: _json, ...payload } = brief;

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  const period =
    brief.period.from === null
      ? "period: no runs in scope"
      : `period: ${brief.period.from.slice(0, 10)} → ${brief.period.to?.slice(0, 10)}`;
  const populations = `introduced by population: pre-spec ${brief.populations.pre_spec} / post-spec ${brief.populations.post_spec} / unknown ${brief.populations.unknown}`;

  const axiomBlocks = brief.top_axioms.flatMap(axiomBlock);
  const removals =
    brief.removal_candidates.length > 0
      ? [
          "",
          `Removal candidates (no evidence in scope — \`praxis axioms audit\` decides): ${brief.removal_candidates.join(", ")}`,
        ]
      : [];

  const entries: DisplayEntry[] = [
    period,
    populations,
    brief.residual_summary,
    ...axiomBlocks,
    ...removals,
    "",
    { text: brief.note, color: "dim" },
  ];

  return [
    { channel: "heading", text: "Harness brief — evidence, suggested diagnoses, human call" },
    { channel: "warning", text: `Calibration: ${brief.calibration}` },
    { channel: "content", entries },
  ];
};

export default harnessBriefView;

/** One axiom's block: the evidence, then the suggestion and its reasoning. */
function axiomBlock(entry: HarnessBriefAxiom): DisplayEntry[] {
  const examples = entry.representative_critiques.map(
    (critique) => `    · ${critique.id}: ${critique.text}`,
  );

  return [
    "",
    `${entry.axiom_id} [${entry.reviewer}] — ${entry.statement}`,
    `  introduction rate ${entry.introduction_rate.display} · debt stock ${entry.debt_stock} · paid down ${entry.paydown}`,
    `  ${entry.trend}`,
    {
      badge: entry.suggested_diagnosis.toUpperCase(),
      color: colorOf(entry.suggested_diagnosis),
      value: entry.diagnosis_reason,
      indent: 1,
    },
    ...examples,
  ];
}

/** Semantic colors: the suspects are not equally alarming. */
function colorOf(
  diagnosis: HarnessBriefAxiom["suggested_diagnosis"],
): "cyan" | "gray" | "red" | "yellow" {
  if (diagnosis === "harness_gap") return "red";

  if (diagnosis === "spec_problem") return "yellow";

  return diagnosis === "reviewer_noise" ? "cyan" : "gray";
}
