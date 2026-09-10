/**
 * A scripted offline curator provider, written into test projects as a
 * `./curator.js` local module — the same seam the demo's word-count
 * provider proves for reviewers.
 *
 * `complete()` answers by the tool it was asked for: the triage tool
 * gets `plan.organization`, the label tool `plan.labels`, traceability
 * `plan.traceability` — each a JSON literal baked into the module, so
 * tests script the curator per project with zero network.
 */
/** What the scripted curator answers per tool. */
export interface CuratorPlan {
  organization?: unknown;
  traceability?: unknown;
  labels?: unknown;
}

export function curatorProviderModule(plan: CuratorPlan): string {
  return `const PLAN = ${JSON.stringify(plan)};

export default function scriptedCurator() {
  return {
    name: "scripted-curator",
    async review() {
      throw new Error("the curator never reviews");
    },
    async complete(request) {
      const toolName = request.tools[0].function.name;
      let args;
      if (toolName === "triage_organization") args = PLAN.organization;
      else if (toolName === "label_critique") {
        // One critique per call: answer by the id in the prompt's critique line.
        const match = request.userPrompt.match(/^- \\[([^\\]]+)\\]/m);
        const entry = (PLAN.labels?.labels ?? []).find((l) => l.critique_id === match?.[1]);
        args = { axiom_id: entry ? entry.axiom_id : null };
      } else args = PLAN.traceability;
      return { toolName, args, usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.001 } };
    },
  };
}
`;
}
