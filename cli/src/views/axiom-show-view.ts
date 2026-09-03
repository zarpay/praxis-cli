import type { AxiomFile } from "@/models/axiom-file.js";
import type { View } from "@framework/types.js";

/**
 * One axiom in full: the facts a reader needs to trust it (identity,
 * lifecycle, grounding), then the statement and both examples — the
 * teaching material the fast loop deliberately leaves behind this
 * drill-down (08, 09).
 */
const axiomShowView: View<{ axiom: AxiomFile; json?: boolean }> = ({ axiom, json }) => {
  if (json) {
    const payload = {
      id: axiom.id,
      version: axiom.version,
      status: axiom.status,
      mode: axiom.mode,
      scope: axiom.scope,
      severity: axiom.severity,
      grounded_in: axiom.groundedIn,
      introduced: axiom.introduced,
      supersedes: axiom.supersedes ?? null,
      statement: axiom.statement(),
      body: axiom.body,
    };

    return [{ channel: "content", entries: [JSON.stringify(payload, null, 2)] }];
  }

  return [
    { channel: "heading", text: `${axiom.id} v${axiom.version} — ${axiom.status}` },
    {
      channel: "content",
      entries: [
        `severity: ${axiom.severity} · mode: ${axiom.mode} · scope: ${axiom.scope}`,
        `introduced: ${axiom.introduced}`,
        `grounded in: ${axiom.groundedIn ?? "— (not ratified yet)"}`,
        ...(axiom.supersedes ? [`supersedes: ${axiom.supersedes}`] : []),
        "",
        axiom.body.trim(),
      ],
    },
  ];
};

export default axiomShowView;
