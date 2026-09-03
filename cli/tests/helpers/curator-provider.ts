/**
 * A scripted offline curator provider, written into test projects as a
 * `./curator.js` local module — the same seam the demo's word-count
 * provider proves for reviewers.
 *
 * `complete()` answers by the tool it was asked for: the triage tool
 * gets `plan.organization`, the gate tool `plan.gate`, traceability
 * `plan.traceability` — each a JSON literal baked into the module, so
 * tests script the curator per project with zero network.
 */
export function curatorProviderModule(plan: {
  organization?: unknown;
  gate?: unknown;
  traceability?: unknown;
}): string {
  return `const PLAN = ${JSON.stringify(plan)};

export default function scriptedCurator() {
  return {
    name: "scripted-curator",
    async review() {
      throw new Error("the curator never reviews");
    },
    async complete(request) {
      const toolName = request.tools[0].function.name;
      const args =
        toolName === "triage_organization" ? PLAN.organization
        : toolName === "authoring_gate" ? PLAN.gate
        : PLAN.traceability;
      return { toolName, args, usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.001 } };
    },
  };
}
`;
}
