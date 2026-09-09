/**
 * Tool definition for triage organization.
 *
 * One tool, one call: the curator's entire organization arrives as a
 * single structured payload the session then walks cluster by cluster.
 * The descriptions are prompt text: they carry the grounded-theory
 * discipline into the schema itself.
 */
export default function triageTools() {
  return [
    {
      type: "function",
      function: {
        name: "triage_organization",
        description:
          "Your organization of the unassigned critiques: clusters, each with exactly one suggestion. Every critique id appears in exactly one cluster.",
        parameters: {
          type: "object",
          properties: {
            clusters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  critique_ids: {
                    type: "array",
                    items: { type: "string" },
                    description: "The critiques in this cluster, by their ids.",
                  },
                  rationale: {
                    type: "string",
                    description: "One sentence: what shared standard makes these one cluster.",
                  },
                  suggestion: {
                    type: "string",
                    enum: ["assign", "propose", "hold"],
                  },
                  axiom_id: {
                    type: ["string", "null"],
                    description:
                      "For assign: the established axiom's id — ONLY when that axiom's fix would resolve every critique in the cluster. Otherwise null.",
                  },
                  draft: {
                    type: ["object", "null"],
                    description: "For propose: the drafted category. Otherwise null.",
                    properties: {
                      statement: {
                        type: "string",
                        description:
                          "One to two sentences NAMING the observed recurring issue, neutrally — never a restated rule, never a prescription. The altitude is one convention the team decides as a unit.",
                      },
                      grounding_hint: {
                        type: "string",
                        description:
                          "The specification passage that grounds caring about this issue, quoted verbatim.",
                      },
                    },
                    required: ["statement", "grounding_hint"],
                  },
                  why_held: {
                    type: ["string", "null"],
                    description:
                      "For hold: why no axiom emerges yet — too little evidence, a spec that does not state the standard, or a mechanical standard that belongs in static tooling.",
                  },
                },
                required: ["critique_ids", "rationale", "suggestion"],
              },
            },
          },
          required: ["clusters"],
        },
      },
    },
  ] as const;
}
